import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractToken, getAuthUser } from '@/lib/auth';

export async function GET(request: Request) {
  const token = extractToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
  }

  const user = await getAuthUser(token);
  if (!user) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 });
  }

  try {
    const favorites = await db.favoriteDocument.findMany({
      where: { userId: user.id },
      include: {
        document: {
          include: {
            type: true,
            creator: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(favorites);
  } catch (error) {
    console.error('Failed to fetch favorites:', error);
    return NextResponse.json({ error: 'Ошибка загрузки избранного' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = extractToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
  }

  const user = await getAuthUser(token);
  if (!user) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'Не указан ID документа' }, { status: 400 });
    }

    // Check if already favorited
    const existing = await db.favoriteDocument.findUnique({
      where: {
        userId_documentId: {
          userId: user.id,
          documentId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Документ уже в избранном' }, { status: 409 });
    }

    const favorite = await db.favoriteDocument.create({
      data: {
        userId: user.id,
        documentId,
      },
      include: {
        document: {
          include: {
            type: true,
            creator: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(favorite, { status: 201 });
  } catch (error) {
    console.error('Failed to add favorite:', error);
    return NextResponse.json({ error: 'Ошибка добавления в избранное' }, { status: 500 });
  }
}
