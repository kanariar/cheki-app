import { PlusCircle, User, Tag } from 'lucide-react';

export default function Home() {
  // 第3段階でSupabaseから取得するデータの「ダミー」です
  const dummyPosts = [
    {
      id: 1,
      date: '2026.05.16',
      imageUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=600&auto=format&fit=crop', // サンプル画像（プレゼント）
      comment: '22歳の誕生日。Rifaのブラシ。',
      tags: [{ name: 'りんりん', type: 'people' }, { name: '誕生日プレゼント', type: 'event' }]
    },
    {
      id: 2,
      date: '2026.06.16',
      imageUrl: 'https://images.unsplash.com/photo-1557142046-c704a3adf364?q=80&w=600&auto=format&fit=crop', // サンプル画像（ホテル）
      comment: '横浜のホテルでヌンチャした。',
      tags: [{ name: 'りんりん', type: 'people' }, { name: 'アフタヌーンティー', type: 'event' }]
    }
  ];

  return (
    <main className="min-h-screen bg-[#fdfbf7] p-4 md:p-8 font-sans text-gray-800">
      {/* ヘッダーエリア */}
      <div className="max-w-4xl mx-auto flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-widest border-b-4 border-orange-500 pb-1">チェキ</h1>
        <button className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-full hover:bg-gray-700 transition">
          <PlusCircle size={20} />
          <span className="hidden md:inline">新しい思い出を登録</span>
        </button>
      </div>

      {/* 絞り込み（タグ）エリア */}
      <div className="max-w-4xl mx-auto mb-8 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <User size={18} className="text-gray-500" />
          <button className="bg-white border border-gray-300 px-3 py-1 rounded-full text-sm shadow-sm hover:bg-gray-50"># りんりん</button>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Tag size={18} className="text-gray-500" />
          <button className="bg-white border border-gray-300 px-3 py-1 rounded-full text-sm shadow-sm hover:bg-gray-50"># 誕生日プレゼント</button>
          <button className="bg-white border border-gray-300 px-3 py-1 rounded-full text-sm shadow-sm hover:bg-gray-50"># アフタヌーンティー</button>
        </div>
      </div>

      {/* ギャラリー（チェキ風カード）エリア */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
        {dummyPosts.map((post) => (
          <div key={post.id} className="bg-white p-4 pb-16 shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-100">
            {/* 写真部分 */}
            <div className="aspect-square w-full overflow-hidden bg-gray-200 mb-4">
              <img src={post.imageUrl} alt="思い出の写真" className="w-full h-full object-cover" />
            </div>
            {/* テキスト部分 */}
            <div className="space-y-2">
              <p className="text-sm text-gray-500 font-mono">{post.date}</p>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag, idx) => (
                  <span key={idx} className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                    # {tag.name}
                  </span>
                ))}
              </div>
              <p className="text-sm mt-2">{post.comment}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}