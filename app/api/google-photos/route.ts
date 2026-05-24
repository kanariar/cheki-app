import { NextRequest, NextResponse } from 'next/server';

// 1. Googleに「これから写真を選ぶよ！」と宣言して、専用のURLを発行してもらう
export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization');
  if (!token) return NextResponse.json({ error: 'Token missing' }, { status: 401 });

  try {
    const res = await fetch('https://photospicker.googleapis.com/v1/sessions', {
      method: 'POST',
      headers: { 'Authorization': token, 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// 2. ユーザーが選び終わったか確認し、選んだ写真をアプリに引っ張ってくる
export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization');
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const action = searchParams.get('action');

  if (!token || !sessionId) return NextResponse.json({ error: 'Params missing' }, { status: 400 });

  try {
    if (action === 'status') {
      const res = await fetch(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
        headers: { 'Authorization': token }
      });
      return NextResponse.json(await res.json());
    } else if (action === 'items') {
      // ★ 修正：最新の仕様に合わせて写真一覧の取得URLを変更しました！
      const res = await fetch(`https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}`, {
        headers: { 'Authorization': token }
      });
      return NextResponse.json(await res.json());
    }
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}