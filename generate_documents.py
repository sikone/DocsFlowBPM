"""
Генератор документов для нагрузочного тестирования DocsFlowBPM.

Зависимости:
    pip install psycopg2-binary

Использование:
    python generate_documents.py                 # 100 000 документов (по умолчанию)
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

SLA_HOURS = {"LOW": 48, "MEDIUM": 24, "HIGH": 8, "CRITICAL": 4}

URGENCY_WEIGHTS = {"LOW": 30, "MEDIUM": 30, "HIGH": 40, "CRITICAL": 15}

# ---------------------------------------------------------------------------
# Шаблоны ProcessDefinition для автосоздания
# Формат steps совместим с API: type in (APPROVAL, CONDITION, START, END)
# API фильтрует только APPROVAL и CONDITION при старте согласования.
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
# ---------------------------------------------------------------------------

def _steps_approved(appr_id, n, users, dt, sla_h):
    """Все шаги завершены."""
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
    """Один шаг REJECTED, предыдущие APPROVED, последующие SKIPPED."""
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
    """
    Часть шагов завершена, оставшиеся PENDING.
    Из PENDING-шагов ~SLA_BREACH_PROB имеют dueAt в прошлом (SLA просрочен).
    """
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
            # SLA-breach: намеренно просроченный дедлайн
            if random.random() < SLA_BREACH_PROB:
                due_at = now - timedelta(hours=random.randint(1, 96))
            else:
                due_at = now + timedelta(hours=random.randint(1, sla_h))
        rows.append((new_id(), appr_id, order, f"Шаг согласования {order + 1}",
                     "APPROVAL", assignee, None, status,
                     due_at, decider, None, decided_at, dt))
    return rows


# ---------------------------------------------------------------------------
# Автосоздание ProcessDefinition
# ---------------------------------------------------------------------------

def ensure_processes(cur, conn, users: list) -> list[dict]:
    """
    Возвращает список {id, n_steps} из ProcessDefinition.
    Если таблица пуста — создаёт шаблонные процессы.
    """
    cur.execute('SELECT id, steps FROM "ProcessDefinition" WHERE status = \'ACTIVE\'')
    rows = cur.fetchall()
    if rows:
        result = []
        for pid, steps_json in rows:
            try:
                steps = json.loads(steps_json or "[]")
                # считаем только APPROVAL-шаги (именно они создаются при старте)
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
        # Формат шагов совместим с API (type=APPROVAL, assigneeType=user|initiator)
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

    print(f"  Пользователей:           {len(users)}")
    print(f"  Типов документов:        {len(doc_types)}")
    print(f"  Папок:                   {len([f for f in folders if f])}")
    print(f"  Тегов:                   {len(tags)}")
    print(f"  Бизнес-процессов:        {len(processes)}")

    return {"users": users, "doc_types": doc_types, "folders": folders, "tags": tags, "processes": processes}


# ---------------------------------------------------------------------------
# Генерация пакета
# ---------------------------------------------------------------------------

def generate_batch(refs: dict, start_seq: int, count: int,
                   ts_start: datetime, ts_end: datetime, now: datetime):
    docs, tag_links, logs, approvals, steps = [], [], [], [], []

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
        if appr_status is not None:
            proc = random.choice(refs["processes"])
            appr_id = new_id()
            # routeId=null, processId=proc["id"]
            approvals.append((appr_id, doc_id, None, proc["id"], appr_status, user_id, dt, dt))

            n = proc["n_steps"]
            if appr_status == "APPROVED":
                batch_steps = _steps_approved(appr_id, n, refs["users"], dt, sla_h)
            elif appr_status == "REJECTED":
                batch_steps = _steps_rejected(appr_id, n, refs["users"], dt, sla_h)
            else:
                batch_steps = _steps_in_progress(appr_id, n, refs["users"], dt, sla_h, now)
            steps.extend(batch_steps)

    return docs, tag_links, logs, approvals, steps


# ---------------------------------------------------------------------------
# SQL и flush
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

# routeId=null, processId=col[3]
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


def flush(cur, docs, tag_links, logs, approvals, steps):
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
        return

    print(f"Найдено {len(doc_ids)} документов. Удаляем...")
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

    # Удаляем автосозданные процессы (только те, что создал этот скрипт)
    sys_names = [t["systemName"] for t in _PROCESS_TEMPLATES]
    cur.execute('DELETE FROM "ProcessDefinition" WHERE "systemName" = ANY(%s)', (sys_names,))
    deleted_proc = cur.rowcount
    conn.commit()
    if deleted_proc:
        print(f"✓ Удалено автосозданных ProcessDefinition: {deleted_proc}")


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

    total_docs = total_tags = total_logs = total_appr = total_steps = 0
    batches = (count + BATCH_SIZE - 1) // BATCH_SIZE

    for idx in range(batches):
        start_seq  = idx * BATCH_SIZE + 1
        batch_size = min(BATCH_SIZE, count - idx * BATCH_SIZE)

        docs, tag_links, logs, appr, steps = generate_batch(
            refs, start_seq, batch_size, ts_start, ts_end, now
        )
        flush(cur, docs, tag_links, logs, appr, steps)
        conn.commit()

        total_docs  += len(docs)
        total_tags  += len(tag_links)
        total_logs  += len(logs)
        total_appr  += len(appr)
        total_steps += len(steps)

        pct = (idx + 1) / batches * 100
        bar = "#" * int(pct / 2) + "." * (50 - int(pct / 2))
        print(f"\r  [{bar}] {pct:5.1f}%  {total_docs:,}/{count:,} docs", end="", flush=True)

    print(f"\n\n✓ Документов:          {total_docs:,}")
    print(f"✓ Связей с тегами:     {total_tags:,}")
    print(f"✓ Записей в логе:      {total_logs:,}")
    print(f"✓ Согласований:        {total_appr:,}")
    print(f"✓ Шагов согласования:  {total_steps:,}")
    print(f"  (из них ~{int(SLA_BREACH_PROB * 100)}% PENDING-шагов просрочены по SLA)")

    cur.close()
    conn.close()
    print("\nГотово.")


if __name__ == "__main__":
    main()
