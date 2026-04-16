import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractToken, getAuthUser } from '@/lib/auth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const token = extractToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
  }

  const user = await getAuthUser(token);
  if (!user) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 });
  }

  try {
    const { documentId } = await params;

    await db.favoriteDocument.deleteMany({
      where: {
        userId: user.id,
        documentId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove favorite:', error);
    return NextResponse.json({ error: 'Ошибка удаления из избранного' }, { status: 500 });
  }
}
