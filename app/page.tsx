import { supabase } from '../lib/supabase';
// ※もし第2段階でlucide-reactのアイコンを使っていたら、ここに追加でimportしてください

export default async function Home() {
  // ① Supabaseのpostsテーブルから、作成日(created_at)の新しい順にすべてのデータを取得
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  // 万が一エラーが起きた場合の画面
  if (error) {
    console.error('データ取得エラー:', error);
    return <div className="p-8 text-red-500">データの読み込みに失敗しました。</div>;
  }

  // ② 取得したデータを画面に流し込む
  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 tracking-wider">My Cheki App</h1>
          {/* ※ここのボタンは第5段階で動かします */}
          <button className="bg-gray-800 text-white px-4 py-2 rounded-full shadow-md hover:bg-gray-700 transition">
            ＋ 新しい思い出
          </button>
        </div>

        {/* チェキカードを並べるグリッド */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {posts?.map((post) => (
            // チェキ風カードのUI（少し傾けるデザイン）
            <div 
              key={post.id} 
              className="bg-white p-4 pb-16 shadow-xl transform odd:-rotate-2 even:rotate-2 hover:rotate-0 hover:scale-105 transition-all duration-300"
            >
              {/* 画像部分（アスペクト比 3:4） */}
              <div className="aspect-[3/4] bg-gray-200 mb-4 overflow-hidden rounded-sm">
                <img 
                  src={post.image_url} 
                  alt="チェキ画像" 
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* コメント部分（手書き風フォントなどが似合います） */}
              <div className="text-gray-700 font-medium text-lg leading-relaxed">
                {post.comment}
              </div>
            </div>
          ))}
        </div>

        {/* データが1件もない場合のメッセージ */}
        {posts?.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            まだ思い出がありません。「＋ 新しい思い出」から登録してみましょう！
          </div>
        )}
      </div>
    </main>
  );
}