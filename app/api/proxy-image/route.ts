import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // ★ 改修：フロントエンドから送られてきたGoogleの合鍵（トークン）を受け取る
  const token = request.headers.get('Authorization'); 
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    // GoogleフォトPicker APIの最新セキュリティ仕様に合わせ、
    // 画像をダウンロードする瞬間にも認証ヘッダーを付与する！
    const fetchOptions: RequestInit = {};
    if (token) {
      fetchOptions.headers = { 'Authorization': token };
    }

    const response = await fetch(imageUrl, fetchOptions);
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Google rejected image download' }, { status: response.status });
    }

    const blob = await response.blob();
    
    return new NextResponse(blob, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}