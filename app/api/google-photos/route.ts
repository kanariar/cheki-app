import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization');
  if (!token) {
    return NextResponse.json({ error: '認証トークンがありません' }, { status: 401 });
  }

  try {
    // サーバー側からGoogleにアクセスする（スマホのブラウザ制限を受けない）
    const res = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=24', {
      headers: { 'Authorization': token }
    });
    const data = await res.json();
    
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}