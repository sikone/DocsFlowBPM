"""
Генератор документов для нагрузочного тестирования DocsFlowBPM.

Зависимости:
    pip install psycopg2-binary

Использование:
    python generate_documents.py                 # 30 000 документов (по умолчанию)
    python generate_documents.py --count 50000   # задать кол-во вручную
    python generate_documents.py --clean         # очистить сгенерированные данные

Что создаётся:
    - Document (основные записи, все статусы)
    - DocumentTagLink (привязка к существующим тегам, случайно)
    - ActivityLog (событие "CREATE" для каждого документа)
    - ProcessDefinition (автосоздаётся если в БД нет ни одного)
    - DocumentApproval (processId → ProcessDefinition) для каждого non-DRAFT документа
    - DocumentApprovalStep (со статусами, согласованными с Approval)
      · ~35% шагов PENDING намеренно просрочены (dueAt < now) — SLA-breach
    - ApprovalStepDecision (история решений по каждому завершённому шагу)
    - DocumentRead (прочтения non-DRAFT документов случайными пользователями)
    - DocumentPermission (права VIEW/EDIT, ~20% non-DRAFT документов)
    - Comment (комментарии, ~25% non-DRAFT документов, 1-3 на документ)
    - Notification (APPROVAL_REQUEST / APPROVAL_DECISION по шагам согласования)
    - DocumentRule (правила маршрутизации для ~60% пользователей, однократно)
"""

import argparse
import json
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

import psycopg2
import psycopg2.extras

# ---------------------------------------------------------------------------
# Конфигурация подключения
# ---------------------------------------------------------------------------
DB_CONFIG = {
    "host":     "localhost",
    "port":     5432,
    "dbname":   "DocsFLOW",
    "user":     "postgres",
    "password": "qaz#123",
}

# ---------------------------------------------------------------------------
# Параметры генерации
# ---------------------------------------------------------------------------
DEFAULT_COUNT    = 30000
BATCH_SIZE       = 500
TAG_LINK_PROB    = 0.6
MAX_TAGS_PER_DOC = 3
DRAFT_PROB       = 0.12    # доля документов без запущенного процесса
SLA_BREACH_PROB  = 0.35    # доля PENDING-шагов, просроченных по SLA
COMMENT_PROB     = 0.25    # доля документов с комментариями
MAX_COMMENTS_PER_DOC = 3
READ_PROB        = 0.70    # доля non-DRAFT документов с прочтениями
MAX_READS_PER_DOC = 5
PERMISSION_PROB  = 0.20    # доля документов с выданными правами
RULES_USER_PROB  = 0.60    # доля пользователей с правилами маршрутизации
MAX_RULES_PER_USER = 3

SLA_HOURS = {"LOW": 48, "MEDIUM": 24, "HIGH": 8, "CRITICAL": 4}

URGENCY_WEIGHTS = {"LOW": 30, "MEDIUM": 30, "HIGH": 40, "CRITICAL": 15}

# ---------------------------------------------------------------------------
# Шаблоны ProcessDefinition для автосоздания
# ---------------------------------------------------------------------------
_PROCESS_TEMPLATES = [
    {
        "name": "Стандартное согласование",
        "systemName": "gen_standard_approval",
        "description": "Базовый маршрут: руководитель → директор",
        "step_names": ["Согласование руководителем", "Утверждение директором"],
    },
    {
        "name": "Расширенное согласование",
        "systemName": "gen_extended_approval",
        "description": "Трёхэтапный маршрут: юрист → руководитель → директор",
        "step_names": ["Юридическая проверка", "Согласование руководителем", "Утверждение директором"],
    },
    {
        "name": "Финансовое согласование",
        "systemName": "gen_finance_approval",
        "description": "Финансовый контроль: бухгалтер → финансовый директор",
        "step_names": ["Проверка бухгалтером", "Утверждение финансовым директором"],
    },
    {
        "name": "Упрощённое согласование",
        "systemName": "gen_simple_approval",
        "description": "Один этап — прямое утверждение",
        "step_names": ["Единоличное утверждение"],
    },
    {
        "name": "Полный цикл согласования",
        "systemName": "gen_full_approval",
        "description": "Четырёхэтапный маршрут для крупных сделок",
        "step_names": [
            "Первичная проверка",
            "Согласование отдела",
            "Утверждение руководителя",
            "Финальное утверждение директором",
        ],
    },
]

_SLA_CONFIG = json.dumps({"LOW": 48, "MEDIUM": 24, "HIGH": 8, "CRITICAL": 4})

# ---------------------------------------------------------------------------
# Шаблоны заголовков
# ---------------------------------------------------------------------------
TITLE_TEMPLATES = [
    "Договор поставки № {n} от {date}",
    "Дополнительное соглашение № {n} к договору",
    "Счёт на оплату № {n}",
    "Акт выполненных работ № {n}",
    "Акт приёма-передачи № {n}",
    "Товарная накладная № {n}",
    "Счёт-фактура № {n} от {date}",
    "Коммерческое предложение № {n}",
    "Заявка на закупку № {n}",
    "Служебная записка № {n}",
    "Приказ № {n} о командировании",
    "Приказ № {n} о назначении",
    "Приложение № {n} к договору",
    "Протокол совещания от {date}",
    "Соглашение о неразглашении № {n}",
    "Лицензионный договор № {n}",
    "Договор оказания услуг № {n} от {date}",
    "Заявление о расторжении договора № {n}",
    "Техническое задание № {n}",
    "Спецификация к договору № {n}",
    "Претензия № {n} от {date}",
    "Уведомление № {n}",
    "Гарантийное письмо № {n}",
    "Доверенность № {n} от {date}",
    "Акт сверки взаимных расчётов № {n}",
]

NOTE_SAMPLES = [
    "Требует согласования с юридическим отделом.",
    "Срочно — дедлайн через 3 дня.",
    "Проверить реквизиты контрагента.",
    "Внести правки по итогам совещания.",
    "Согласовано устно, требуется письменное подтверждение.",
    "Приложить сканы оригиналов.",
    "Обратить внимание на п. 4.2 договора.",
    "Повторная редакция после замечаний.",
    "", "", "",
]

COMMENT_SAMPLES = [
    "Согласован. Замечаний нет.",
    "Прошу уточнить реквизиты в разделе 3.",
    "Необходимо приложить дополнительные документы.",
    "Документ соответствует требованиям.",
    "Требуется дополнительная проверка юридическим отделом.",
    "Внесены изменения согласно замечаниям.",
    "Подтверждаю получение документа.",
    "Направлено на повторное рассмотрение.",
    "Обратить внимание на сроки исполнения.",
    "Согласован с учётом внесённых правок.",
    "Необходимо пересмотреть условия оплаты.",
    "Документ принят к исполнению.",
    "Прошу рассмотреть в приоритетном порядке.",
    "Есть замечания по разделу об ответственности.",
    "Условия договора требуют дополнительного обсуждения.",
]

_RULE_NAME_TEMPLATES = [
    "Автоправило — срочные документы",
    "Автоправило — низкий приоритет",
    "Автоправило — завершённые документы",
    "Автоправило — черновики в обработку",
    "Автоправило — критическая срочность",
    "Автоправило — документы в работе",
    "Автоправило — автотег входящих",
    "Автоправило — маршрутизация договоров",
    "Автоправило — утверждённые документы",
    "Автоправило — отклонённые на доработку",
]

# ---------------------------------------------------------------------------
# Утилиты
# ---------------------------------------------------------------------------

def new_id() -> str:
    return uuid.uuid4().hex


def weighted_choice(weights: dict) -> str:
    return random.choices(list(weights.keys()), weights=list(weights.values()), k=1)[0]


def random_date(start: datetime, end: datetime) -> datetime:
    delta = end - start
    seconds = random.randint(0, int(delta.total_seconds()))
    return start + timedelta(seconds=seconds)


def make_doc_number(seq: int) -> str:
    return f"ДОК-{seq:07d}"


def make_title(seq: int) -> str:
    tpl = random.choice(TITLE_TEMPLATES)
    dt = random_date(datetime(2023, 1, 1, tzinfo=timezone.utc), datetime(2025, 12, 31, tzinfo=timezone.utc))
    return tpl.format(n=seq, date=dt.strftime("%d.%m.%Y"))


def make_form_data(schema: list, seq: int) -> str:
    data: dict = {}
    for field in schema:
        field_type = field.get("type", "text")
        sys_name = field.get("systemName") or field.get("id", "")
        if not sys_name or field_type in ("heading", "separator"):
            continue
        if field_type == "text":
            data[sys_name] = f"Значение поля {seq}"
        elif field_type == "textarea":
            data[sys_name] = random.choice(NOTE_SAMPLES) or f"Описание № {seq}"
        elif field_type == "number":
            data[sys_name] = str(random.randint(1, 100_000))
        elif field_type == "money":
            data[sys_name] = str(round(random.uniform(1_000, 5_000_000), 2))
        elif field_type == "date":
            dt = random_date(datetime(2023, 1, 1, tzinfo=timezone.utc), datetime(2026, 1, 1, tzinfo=timezone.utc))
            data[sys_name] = dt.strftime("%Y-%m-%d")
        elif field_type == "select":
            options = field.get("options") or []
            data[sys_name] = random.choice(options) if options else ""
        elif field_type in ("checkbox", "switch"):
            data[sys_name] = str(random.choice(["true", "false"]))
        elif field_type == "email":
            data[sys_name] = f"contact{seq}@example.com"
        elif field_type == "phone":
            n = random.randint(10, 99)
            data[sys_name] = f"+7 9{n} {random.randint(100,999)}-{random.randint(10,99)}-{random.randint(10,99)}"
        else:
            data[sys_name] = f"{seq}"
    return json.dumps(data, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Генерация шагов DocumentApprovalStep по статусу согласования
# Кортеж: (id, approvalId, order, name, stepType, userId, departmentId,
#           status, dueAt, decidedById, comment, decidedAt, createdAt)
# ---------------------------------------------------------------------------

def _steps_approved(appr_id, n, users, dt, sla_h):
    rows = []
    for order in range(n):
        assignee = random.choice(users)
        decided_at = dt + timedelta(hours=random.randint(1, max(1, sla_h - 1)))
        due_at = dt + timedelta(hours=sla_h * (order + 1))
        status = "APPROVED" if random.random() > 0.15 else "APPROVED_WITH_CHANGES"
        rows.append((new_id(), appr_id, order, f"Шаг согласования {order + 1}",
                     "APPROVAL", assignee, None, status,
                     due_at, assignee, None, decided_at, dt))
    return rows


def _steps_rejected(appr_id, n, users, dt, sla_h):
    reject_at = random.randint(0, n - 1)
    rows = []
    for order in range(n):
        assignee = random.choice(users)
        due_at = dt + timedelta(hours=sla_h * (order + 1))
        if order < reject_at:
            status = "APPROVED"
            decided_at = dt + timedelta(hours=random.randint(1, max(1, sla_h - 1)))
            decider = assignee
        elif order == reject_at:
            status = "REJECTED"
            decided_at = dt + timedelta(hours=random.randint(1, 48))
            decider = assignee
        else:
            status = "SKIPPED"
            decided_at = None
            decider = None
        rows.append((new_id(), appr_id, order, f"Шаг согласования {order + 1}",
                     "APPROVAL", assignee, None, status,
                     due_at, decider, None, decided_at, dt))
    return rows


def _steps_in_progress(appr_id, n, users, dt, sla_h, now):
    completed = random.randint(0, n - 1)
    rows = []
    for order in range(n):
        assignee = random.choice(users)
        if order < completed:
            status = "APPROVED" if random.random() > 0.1 else "APPROVED_WITH_CHANGES"
            decided_at = dt + timedelta(hours=random.randint(1, max(1, sla_h - 1)))
            decider = assignee
            due_at = dt + timedelta(hours=sla_h * (order + 1))
        else:
            status = "PENDING"
            decided_at = None
            decider = None
            if random.random() < SLA_BREACH_PROB:
                due_at = now - timedelta(hours=random.randint(1, 96))
            else:
                due_at = now + timedelta(hours=random.randint(1, sla_h))
        rows.append((new_id(), appr_id, order, f"Шаг согласования {order + 1}",
                     "APPROVAL", assignee, None, status,
                     due_at, decider, None, decided_at, dt))
    return rows


# ---------------------------------------------------------------------------
# Правила маршрутизации DocumentRule
# ---------------------------------------------------------------------------

def _make_rule_conditions() -> list:
    all_options = [
        ("urgency", "eq",  "HIGH"),
        ("urgency", "eq",  "CRITICAL"),
        ("urgency", "eq",  "LOW"),
        ("urgency", "neq", "LOW"),
        ("status",  "eq",  "DRAFT"),
        ("status",  "eq",  "COMPLETED"),
        ("status",  "eq",  "IN_PROGRESS"),
        ("status",  "neq", "DRAFT"),
    ]
    n = random.randint(1, 2)
    chosen = random.sample(all_options, min(n, len(all_options)))
    return [{"id": new_id(), "field": f, "operator": op, "value": v} for f, op, v in chosen]


def _make_rule_actions(folders: list, tags: list) -> list:
    possible = []
    if tags:
        possible.append(("addTag", tags))
    if folders:
        possible.append(("moveToFolder", folders))
    if not possible:
        return []
    chosen = random.sample(possible, min(random.randint(1, 2), len(possible)))
    actions = []
    for action_type, pool in chosen:
        if action_type == "addTag":
            actions.append({"id": new_id(), "type": "addTag", "tagId": random.choice(pool)})
        else:
            actions.append({"id": new_id(), "type": "moveToFolder", "folderId": random.choice(pool)})
    return actions


def ensure_rules(cur, conn, users: list, folders: list, tags: list) -> int:
    """Создаёт DocumentRule для ~60% пользователей. Пропускает если уже есть."""
    cur.execute("SELECT COUNT(*) FROM \"DocumentRule\" WHERE name LIKE 'Автоправило — %'")
    if cur.fetchone()[0] > 0:
        return 0

    active_folders = [f for f in folders if f]
    if not active_folders and not tags:
        return 0

    now = datetime.now(timezone.utc)
    rows = []

    for user_id in users:
        if random.random() > RULES_USER_PROB:
            continue
        n = random.randint(1, MAX_RULES_PER_USER)
        selected_names = random.sample(_RULE_NAME_TEMPLATES, min(n, len(_RULE_NAME_TEMPLATES)))
        for order, name in enumerate(selected_names):
            conditions = _make_rule_conditions()
            actions = _make_rule_actions(active_folders, tags)
            if not actions:
                continue
            rows.append((
                new_id(), user_id, name, True, order,
                random.random() < 0.3,
                random.choice(["AND", "OR"]),
                json.dumps(conditions, ensure_ascii=False),
                json.dumps(actions, ensure_ascii=False),
                now, now,
            ))

    if not rows:
        return 0

    psycopg2.extras.execute_values(cur, RULE_SQL, rows, page_size=BATCH_SIZE)
    conn.commit()
    return len(rows)


# ---------------------------------------------------------------------------
# Автосоздание ProcessDefinition
# ---------------------------------------------------------------------------

def ensure_processes(cur, conn, users: list) -> list[dict]:
    cur.execute('SELECT id, steps FROM "ProcessDefinition" WHERE status = \'ACTIVE\'')
    rows = cur.fetchall()
    if rows:
        result = []
        for pid, steps_json in rows:
            try:
                steps = json.loads(steps_json or "[]")
                n = sum(1 for s in steps if s.get("type") == "APPROVAL")
                n = n or 1
            except Exception:
                n = 2
            result.append({"id": pid, "n_steps": n})
        return result

    print("  ProcessDefinition не найден — создаём шаблонные бизнес-процессы...")
    now = datetime.now(timezone.utc)
    created = []

    for tmpl in _PROCESS_TEMPLATES:
        pid = new_id()
        step_names = tmpl["step_names"]
        steps_json = json.dumps([
            {
                "id": new_id(),
                "type": "APPROVAL",
                "name": name,
                "assigneeType": "initiator" if i == 0 else "user",
                "userId": random.choice(users) if users else None,
                "departmentId": None,
                "slaConfig": _SLA_CONFIG,
            }
            for i, name in enumerate(step_names)
        ], ensure_ascii=False)

        cur.execute(
            'INSERT INTO "ProcessDefinition" (id, name, description, "systemName", version, status, steps, "createdAt", "updatedAt") '
            'VALUES (%s, %s, %s, %s, 1, \'ACTIVE\', %s, %s, %s) ON CONFLICT ("systemName") DO NOTHING',
            (pid, tmpl["name"], tmpl["description"], tmpl["systemName"], steps_json, now, now),
        )
        created.append({"id": pid, "n_steps": len(step_names)})

    conn.commit()
    print(f"  Создано процессов: {len(created)}")
    return created


# ---------------------------------------------------------------------------
# Загрузка справочников из БД
# ---------------------------------------------------------------------------

def load_refs(cur, conn) -> dict:
    cur.execute('SELECT id FROM "User" WHERE active = true')
    users = [row[0] for row in cur.fetchall()]
    if not users:
        raise RuntimeError("В БД нет активных пользователей.")

    cur.execute('SELECT id, "formSchema" FROM "DocumentType" WHERE active = true')
    doc_types = []
    for type_id, schema_str in cur.fetchall():
        try:
            schema = json.loads(schema_str or "[]")
        except json.JSONDecodeError:
            schema = []
        doc_types.append({"id": type_id, "schema": schema})
    if not doc_types:
        raise RuntimeError("В БД нет активных типов документов.")

    cur.execute('SELECT id FROM "Folder"')
    folders = [row[0] for row in cur.fetchall()] or [None]

    cur.execute('SELECT id FROM "DocumentTag"')
    tags = [row[0] for row in cur.fetchall()]

    processes = ensure_processes(cur, conn, users)

    rule_count = ensure_rules(cur, conn, users, folders, tags)

    print(f"  Пользователей:           {len(users)}")
    print(f"  Типов документов:        {len(doc_types)}")
    print(f"  Папок:                   {len([f for f in folders if f])}")
    print(f"  Тегов:                   {len(tags)}")
    print(f"  Бизнес-процессов:        {len(processes)}")
    if rule_count:
        print(f"  Создано правил:          {rule_count}")

    return {"users": users, "doc_types": doc_types, "folders": folders, "tags": tags, "processes": processes}


# ---------------------------------------------------------------------------
# Генерация пакета
# ---------------------------------------------------------------------------

def generate_batch(refs: dict, start_seq: int, count: int,
                   ts_start: datetime, ts_end: datetime, now: datetime):
    docs, tag_links, logs, approvals, steps = [], [], [], [], []
    decisions, reads, permissions, comments, notifications = [], [], [], [], []

    for i in range(count):
        seq = start_seq + i
        doc_id = new_id()
        user_id = random.choice(refs["users"])
        dt = random_date(ts_start, ts_end)
        doc_type = random.choice(refs["doc_types"])
        urgency = weighted_choice(URGENCY_WEIGHTS)
        folder_id = random.choice(refs["folders"])
        sla_h = SLA_HOURS[urgency]

        is_draft = random.random() < DRAFT_PROB

        if is_draft:
            doc_status = "DRAFT"
            appr_status = None
        else:
            appr_status = random.choices(
                ["IN_PROGRESS", "APPROVED", "REJECTED"],
                weights=[45, 40, 15], k=1,
            )[0]
            if appr_status == "APPROVED":
                doc_status = random.choices(["APPROVED", "COMPLETED"], weights=[60, 40], k=1)[0]
            elif appr_status == "REJECTED":
                doc_status = "REJECTED"
            else:
                doc_status = "IN_PROGRESS"

        docs.append((
            doc_id, make_title(seq), make_doc_number(seq), doc_type["id"],
            folder_id, doc_status, urgency, make_form_data(doc_type["schema"], seq),
            user_id, dt, dt,
        ))

        # Теги
        if refs["tags"] and random.random() < TAG_LINK_PROB:
            picked = random.sample(refs["tags"], k=min(
                random.randint(1, MAX_TAGS_PER_DOC), len(refs["tags"])
            ))
            for tag_id in picked:
                tag_links.append((new_id(), doc_id, tag_id, dt))

        # Лог создания
        logs.append((
            new_id(), user_id, "CREATE", "DOCUMENT", doc_id,
            json.dumps({"title": make_title(seq), "generated": True}, ensure_ascii=False),
            dt,
        ))

        # Согласование (не для черновиков)
        batch_steps = []
        if appr_status is not None:
            proc = random.choice(refs["processes"])
            appr_id = new_id()
            approvals.append((appr_id, doc_id, None, proc["id"], appr_status, user_id, dt, dt))

            n = proc["n_steps"]
            if appr_status == "APPROVED":
                batch_steps = _steps_approved(appr_id, n, refs["users"], dt, sla_h)
            elif appr_status == "REJECTED":
                batch_steps = _steps_rejected(appr_id, n, refs["users"], dt, sla_h)
            else:
                batch_steps = _steps_in_progress(appr_id, n, refs["users"], dt, sla_h, now)
            steps.extend(batch_steps)

            # ApprovalStepDecision: история решений по завершённым шагам
            for step_row in batch_steps:
                step_id, _, _, step_name, _, assignee_id, _, step_status, _, decided_by, _, decided_at, _ = step_row
                if decided_by and step_status in ("APPROVED", "APPROVED_WITH_CHANGES", "REJECTED"):
                    decisions.append((
                        new_id(), step_id, step_status,
                        random.choice([None, None, "Замечания учтены", "Согласовано без замечаний", None]),
                        decided_by, decided_at,
                    ))
                    # Notification APPROVAL_DECISION → автор документа (~70%)
                    if random.random() < 0.70:
                        action_word = "отклонён" if step_status == "REJECTED" else "согласован"
                        notifications.append((
                            new_id(), user_id, "APPROVAL_DECISION",
                            f"Документ {action_word} на шаге «{step_name}»",
                            None, random.random() < 0.55,
                            "DOCUMENT", doc_id, decided_at,
                        ))

                # Notification APPROVAL_REQUEST → исполнитель шага
                if assignee_id:
                    is_read = step_status not in ("PENDING",)
                    notif_dt = dt + timedelta(minutes=random.randint(0, 30))
                    notifications.append((
                        new_id(), assignee_id, "APPROVAL_REQUEST",
                        f"Требуется согласование: {step_name}",
                        None, is_read, "DOCUMENT", doc_id, notif_dt,
                    ))

        # DocumentRead: случайные прочтения non-DRAFT документа
        if not is_draft and random.random() < READ_PROB:
            n_reads = random.randint(1, MAX_READS_PER_DOC)
            readers = random.sample(refs["users"], min(n_reads, len(refs["users"])))
            for reader_id in readers:
                reads.append((new_id(), reader_id, doc_id, random_date(dt, now)))

        # DocumentPermission: права VIEW/EDIT для сторонних пользователей
        if not is_draft and random.random() < PERMISSION_PROB:
            other_users = [u for u in refs["users"] if u != user_id]
            if other_users:
                n_perm = random.randint(1, min(2, len(other_users)))
                for perm_user_id in random.sample(other_users, n_perm):
                    permission = random.choice(["VIEW", "EDIT"])
                    perm_dt = dt + timedelta(minutes=random.randint(5, 120))
                    permissions.append((
                        new_id(), doc_id, perm_user_id, permission, user_id,
                        perm_dt, perm_dt,
                    ))

        # Comment: комментарии к некоторым non-DRAFT документам
        if not is_draft and random.random() < COMMENT_PROB:
            n_comm = random.randint(1, MAX_COMMENTS_PER_DOC)
            for _ in range(n_comm):
                commenter = random.choice(refs["users"])
                comm_dt = random_date(dt, now)
                comments.append((
                    new_id(), random.choice(COMMENT_SAMPLES),
                    doc_id, commenter, comm_dt, comm_dt,
                ))

    return docs, tag_links, logs, approvals, steps, decisions, reads, permissions, comments, notifications


# ---------------------------------------------------------------------------
# SQL-шаблоны и flush
# ---------------------------------------------------------------------------

DOC_SQL = """
INSERT INTO "Document" (id, title, number, "typeId", "folderId", status, urgency, data, "createdById", "createdAt", "updatedAt")
VALUES %s ON CONFLICT (id) DO NOTHING
"""

TAG_LINK_SQL = """
INSERT INTO "DocumentTagLink" (id, "documentId", "tagId", "createdAt")
VALUES %s ON CONFLICT DO NOTHING
"""

LOG_SQL = """
INSERT INTO "ActivityLog" (id, "userId", action, "entityType", "entityId", details, "createdAt")
VALUES %s ON CONFLICT (id) DO NOTHING
"""

APPROVAL_SQL = """
INSERT INTO "DocumentApproval" (id, "documentId", "routeId", "processId", status, "createdById", "createdAt", "updatedAt")
VALUES %s ON CONFLICT (id) DO NOTHING
"""

STEP_SQL = """
INSERT INTO "DocumentApprovalStep"
  (id, "approvalId", "order", name, "stepType", "userId", "departmentId", status,
   "dueAt", "decidedById", comment, "decidedAt", "createdAt")
VALUES %s ON CONFLICT (id) DO NOTHING
"""

DECISION_SQL = """
INSERT INTO "ApprovalStepDecision" (id, "stepId", decision, comment, "decidedById", "createdAt")
VALUES %s ON CONFLICT (id) DO NOTHING
"""

READ_SQL = """
INSERT INTO "DocumentRead" (id, "userId", "documentId", "readAt")
VALUES %s ON CONFLICT ("userId", "documentId") DO NOTHING
"""

PERMISSION_SQL = """
INSERT INTO "DocumentPermission" (id, "documentId", "userId", permission, "grantedById", "createdAt", "updatedAt")
VALUES %s ON CONFLICT ("documentId", "userId") DO NOTHING
"""

COMMENT_SQL = """
INSERT INTO "Comment" (id, content, "documentId", "userId", "createdAt", "updatedAt")
VALUES %s ON CONFLICT (id) DO NOTHING
"""

NOTIFICATION_SQL = """
INSERT INTO "Notification" (id, "userId", type, title, body, "isRead", "entityType", "entityId", "createdAt")
VALUES %s ON CONFLICT (id) DO NOTHING
"""

RULE_SQL = """
INSERT INTO "DocumentRule" (id, "userId", name, active, "order", "stopOnMatch", "conditionLogic", conditions, actions, "createdAt", "updatedAt")
VALUES %s ON CONFLICT (id) DO NOTHING
"""


def flush(cur, docs, tag_links, logs, approvals, steps,
          decisions, reads, permissions, comments, notifications):
    if docs:
        psycopg2.extras.execute_values(cur, DOC_SQL, docs, page_size=BATCH_SIZE)
    if tag_links:
        psycopg2.extras.execute_values(cur, TAG_LINK_SQL, tag_links, page_size=BATCH_SIZE)
    if logs:
        psycopg2.extras.execute_values(cur, LOG_SQL, logs, page_size=BATCH_SIZE)
    if approvals:
        psycopg2.extras.execute_values(cur, APPROVAL_SQL, approvals, page_size=BATCH_SIZE)
    if steps:
        psycopg2.extras.execute_values(cur, STEP_SQL, steps, page_size=BATCH_SIZE)
    if decisions:
        psycopg2.extras.execute_values(cur, DECISION_SQL, decisions, page_size=BATCH_SIZE)
    if reads:
        psycopg2.extras.execute_values(cur, READ_SQL, reads, page_size=BATCH_SIZE)
    if permissions:
        psycopg2.extras.execute_values(cur, PERMISSION_SQL, permissions, page_size=BATCH_SIZE)
    if comments:
        psycopg2.extras.execute_values(cur, COMMENT_SQL, comments, page_size=BATCH_SIZE)
    if notifications:
        psycopg2.extras.execute_values(cur, NOTIFICATION_SQL, notifications, page_size=BATCH_SIZE)


# ---------------------------------------------------------------------------
# Очистка
# ---------------------------------------------------------------------------

def clean_generated(cur, conn):
    print("Поиск сгенерированных документов...")
    cur.execute("""
        SELECT DISTINCT "entityId" FROM "ActivityLog"
        WHERE action = 'CREATE'
          AND "entityType" = 'DOCUMENT'
          AND details::jsonb ? 'generated'
          AND (details::jsonb->>'generated')::boolean = true
    """)
    doc_ids = [r[0] for r in cur.fetchall()]
    if not doc_ids:
        print("Нет сгенерированных документов.")
    else:
        print(f"Найдено {len(doc_ids)} документов. Удаляем...")

        # Уведомления не каскадируются от Document — удаляем отдельно
        for i in range(0, len(doc_ids), 1000):
            chunk = doc_ids[i:i + 1000]
            cur.execute(
                'DELETE FROM "Notification" WHERE "entityType" = \'DOCUMENT\' AND "entityId" = ANY(%s)',
                (chunk,),
            )
        conn.commit()

        # Document каскадно удаляет: DocumentApproval → Step → Decision,
        # DocumentTagLink, DocumentRead, DocumentPermission, Comment
        for i in range(0, len(doc_ids), 1000):
            chunk = doc_ids[i:i + 1000]
            cur.execute('DELETE FROM "Document" WHERE id = ANY(%s)', (chunk,))
            conn.commit()
            print(f"  {min(i + 1000, len(doc_ids))}/{len(doc_ids)}", end="\r")

        cur.execute("""
            DELETE FROM "ActivityLog"
            WHERE action = 'CREATE' AND "entityType" = 'DOCUMENT'
              AND details::jsonb ? 'generated'
              AND (details::jsonb->>'generated')::boolean = true
        """)
        conn.commit()
        print(f"\n✓ Удалено {len(doc_ids)} документов и связанных записей.")

    # Автосозданные процессы
    sys_names = [t["systemName"] for t in _PROCESS_TEMPLATES]
    cur.execute('DELETE FROM "ProcessDefinition" WHERE "systemName" = ANY(%s)', (sys_names,))
    deleted_proc = cur.rowcount
    conn.commit()
    if deleted_proc:
        print(f"✓ Удалено автосозданных ProcessDefinition: {deleted_proc}")

    # Правила маршрутизации, созданные этим скриптом
    cur.execute("DELETE FROM \"DocumentRule\" WHERE name LIKE 'Автоправило — %'")
    deleted_rules = cur.rowcount
    conn.commit()
    if deleted_rules:
        print(f"✓ Удалено правил маршрутизации: {deleted_rules}")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Генератор документов для нагрузочного тестирования")
    parser.add_argument("--count", type=int, default=DEFAULT_COUNT,
                        help=f"Количество документов (по умолчанию {DEFAULT_COUNT})")
    parser.add_argument("--clean", action="store_true",
                        help="Удалить все ранее сгенерированные документы")
    args = parser.parse_args()

    print("Подключение к PostgreSQL...")
    try:
        conn = psycopg2.connect(**DB_CONFIG)
    except psycopg2.OperationalError as e:
        print(f"Ошибка подключения: {e}")
        sys.exit(1)

    conn.autocommit = False
    cur = conn.cursor()

    if args.clean:
        clean_generated(cur, conn)
        cur.close()
        conn.close()
        return

    count = args.count
    print(f"\nЦель: {count:,} документов  |  пакет: {BATCH_SIZE}")
    print(f"  ~{int((1 - DRAFT_PROB) * 100)}% документов получат бизнес-процесс согласования")
    print(f"  ~{int(SLA_BREACH_PROB * 100)}% активных шагов будут просрочены по SLA\n")

    print("Загрузка справочников...")
    refs = load_refs(cur, conn)
    print()

    ts_start = datetime(2022, 1, 1, tzinfo=timezone.utc)
    ts_end   = datetime(2026, 4, 1, tzinfo=timezone.utc)
    now      = datetime.now(timezone.utc)

    totals = {k: 0 for k in ("docs", "tags", "logs", "appr", "steps",
                               "decisions", "reads", "permissions", "comments", "notifications")}
    batches = (count + BATCH_SIZE - 1) // BATCH_SIZE

    for idx in range(batches):
        start_seq  = idx * BATCH_SIZE + 1
        batch_size = min(BATCH_SIZE, count - idx * BATCH_SIZE)

        result = generate_batch(refs, start_seq, batch_size, ts_start, ts_end, now)
        docs, tag_links, logs, appr, steps, decisions, reads, perms, comms, notifs = result

        flush(cur, docs, tag_links, logs, appr, steps, decisions, reads, perms, comms, notifs)
        conn.commit()

        totals["docs"]          += len(docs)
        totals["tags"]          += len(tag_links)
        totals["logs"]          += len(logs)
        totals["appr"]          += len(appr)
        totals["steps"]         += len(steps)
        totals["decisions"]     += len(decisions)
        totals["reads"]         += len(reads)
        totals["permissions"]   += len(perms)
        totals["comments"]      += len(comms)
        totals["notifications"] += len(notifs)

        pct = (idx + 1) / batches * 100
        bar = "#" * int(pct / 2) + "." * (50 - int(pct / 2))
        print(f"\r  [{bar}] {pct:5.1f}%  {totals['docs']:,}/{count:,} docs", end="", flush=True)

    print(f"\n\n✓ Документов:              {totals['docs']:,}")
    print(f"✓ Связей с тегами:         {totals['tags']:,}")
    print(f"✓ Записей в логе:          {totals['logs']:,}")
    print(f"✓ Согласований:            {totals['appr']:,}")
    print(f"✓ Шагов согласования:      {totals['steps']:,}")
    print(f"✓ Решений по шагам:        {totals['decisions']:,}")
    print(f"✓ Прочтений документов:    {totals['reads']:,}")
    print(f"✓ Прав доступа:            {totals['permissions']:,}")
    print(f"✓ Комментариев:            {totals['comments']:,}")
    print(f"✓ Уведомлений:             {totals['notifications']:,}")
    print(f"  (из них ~{int(SLA_BREACH_PROB * 100)}% PENDING-шагов просрочены по SLA)")

    cur.close()
    conn.close()
    print("\nГотово.")


if __name__ == "__main__":
    main()
