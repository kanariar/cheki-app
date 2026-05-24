"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import NewPostModal from '../components/NewPostModal';

interface Post { 
  id: string; 
  image_url: string; 
  comment: string; 
  date: string; 
  created_at: string; 
  post_tags: { tags: { id: string; name: string; type: string } }[]; 
}
interface Tag { id: string; name: string; type: string; }

const ALLOWED_ADMIN_EMAIL = "yuno.crescent25@gmail.com"; 

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  
  const [selectedPeopleId, setSelectedPeopleId] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>(""); 
  
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: postsData } = await supabase
        .from('posts')
        .select(`id, image_url, comment, date, created_at, post_tags (tags ( id, name, type ))`)
        .order('date', { ascending: false });
      
      const { data: tagsData } = await supabase.from('tags').select('*');
      
      setPosts(postsData as any || []);
      setTags(tagsData || []);
    } catch (e) {
      console.error("データ取得エラー:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkSecurityGuard = async (currentSession: any) => {
      if (currentSession) {
        if (currentSession.user.email !== ALLOWED_ADMIN_EMAIL) {
          setAuthError(`アクセスが拒否されました。アカウント「${currentSession.user.email}」はこのアプリの管理者ではありません。`);
          await supabase.auth.signOut(); 
          setSession(null);
          return;
        }
        setAuthError(null);
        fetchData();
      } else {
        setPosts([]);
        setTags([]);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => { 
      setSession(session);
      checkSecurityGuard(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { 
      setSession(session);
      checkSecurityGuard(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` }
    });
  };

  const timeOptions: { label: string; value: string }[] = [];
  const yearSet = new Set<string>();
  const yearMonthSet = new Set<string>();

  posts.forEach(post => {
    if (post.date) {
      const yyyy = post.date.substring(0, 4); 
      const yyyyMm = post.date.substring(0, 7); 
      yearSet.add(yyyy);
      yearMonthSet.add(yyyyMm);
    }
  });

  Array.from(yearSet).sort().reverse().forEach(year => {
    timeOptions.push({ label: `${year}年 (すべて)`, value: year });
    Array.from(yearMonthSet)
      .filter(ym => ym.startsWith(year))
      .sort().reverse()
      .forEach(ym => {
        const month = ym.substring(5, 7);
        timeOptions.push({ label: ` ${year}.${month}`, value: ym }); 
      });
  });

  const filteredPosts = posts.filter(post => {
    if (selectedPeopleId) {
      const hasPeople = post.post_tags?.some(pt => String(pt.tags?.id) === String(selectedPeopleId));
      if (!hasPeople) return false;
    }
    if (selectedEventId) {
      const hasEvent = post.post_tags?.some(pt => String(pt.tags?.id) === String(selectedEventId));
      if (!hasEvent) return false;
    }
    if (selectedTime) {
      if (!post.date || !post.date.startsWith(selectedTime)) return false;
    }
    return true;
  });

  const handleResetFilter = () => {
    setSelectedPeopleId("");
    setSelectedEventId("");
    setSelectedTime("");
  };

  if (loading && session) return <div className="p-8 text-center text-gray-500 font-medium">読み込み中...</div>;

  if (!session) {
    return (
      <main className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2 tracking-wider">Cheki</h1>
          <p className="text-sm text-gray-500 mb-6">思い出を記録するプライベート空間</p>
          {authError && (
            <div className="bg-red-50 text-red-600 text-xs font-semibold p-3 rounded-xl mb-6 border border-red-200 text-left leading-relaxed animate-pulse">⚠️ {authError}</div>
          )}
          <button onClick={signInWithGoogle} className="w-full bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-xl shadow-sm hover:bg-gray-50 transition flex items-center justify-center gap-3 font-bold text-base">
            Googleアカウントでログイン
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* ★ 改修：ヘッダーをスッキリ化（ログアウト削除、タイトル変更） */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-wider">Cheki</h1>
          <div className="flex items-center gap-3">
            <NewPostModal onSuccess={fetchData} tags={tags} />
          </div>
        </div>

        {/* ★ 改修：スマホでは縦並び・左揃え、PCでは横並びのフィルターUI */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8 bg-white p-4 rounded-xl shadow-sm text-sm">
          
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Filter:</span>
            {/* スマホ用リセットボタン（右上に配置） */}
            {(selectedPeopleId || selectedEventId || selectedTime) && (
              <button onClick={handleResetFilter} className="sm:hidden text-xs font-bold text-red-500 hover:text-red-700 underline transition">
                🔄 リセット
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-gray-500 w-5 text-center">📅</span>
            <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} className="flex-1 sm:w-auto border border-gray-300 p-2 rounded-md bg-gray-50 text-gray-700 focus:outline-none font-medium text-xs">
              <option value="">すべての時期</option>
              {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-500 w-5 text-center">👤</span>
            <select value={selectedPeopleId} onChange={(e) => setSelectedPeopleId(e.target.value)} className="flex-1 sm:w-auto border border-gray-300 p-2 rounded-md bg-gray-50 text-gray-700 focus:outline-none font-medium text-xs">
              <option value="">すべての人物</option>
              {tags.filter(t => t.type === 'people').map(tag => <option key={tag.id} value={tag.id}>#{tag.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-500 w-5 text-center">🏷️</span>
            <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="flex-1 sm:w-auto border border-gray-300 p-2 rounded-md bg-gray-50 text-gray-700 focus:outline-none font-medium text-xs">
              <option value="">すべてのイベント</option>
              {tags.filter(t => t.type === 'event').map(tag => <option key={tag.id} value={tag.id}>#{tag.name}</option>)}
            </select>
          </div>

          {/* PC用リセットボタン（右端に配置） */}
          {(selectedPeopleId || selectedEventId || selectedTime) && (
            <button onClick={handleResetFilter} className="hidden sm:block text-xs font-bold text-red-500 hover:text-red-700 underline ml-auto transition">
              🔄 フィルターをリセット
            </button>
          )}
        </div>

        {/* タイムライン */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {filteredPosts.map((post) => (
            <div key={post.id} className="bg-white p-4 pb-20 shadow-xl transform odd:-rotate-2 even:rotate-2 hover:rotate-0 hover:scale-105 transition-all duration-300 relative">
              <div className="aspect-[3/4] bg-gray-200 mb-4 overflow-hidden rounded-sm">
                <img src={post.image_url} alt="チェキ" className="w-full h-full object-cover" />
              </div>
              <div className="text-gray-700 font-medium text-lg leading-relaxed mb-3 whitespace-pre-wrap">{post.comment}</div>
              
              <div className="absolute bottom-4 right-5 text-gray-400 font-mono text-sm tracking-tighter italic font-bold">
                {post.date ? post.date.replace(/-/g, '.') : '----.--.--'}
              </div>

              <div className="flex flex-wrap gap-1 absolute bottom-4 left-4 max-w-[70%]">
                {post.post_tags?.map((pt, i) => pt.tags && (
                  <span 
                    key={i} 
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shadow-sm ${
                      pt.tags.type === 'people' 
                        ? 'bg-blue-50 text-blue-600 border-blue-100' 
                        : 'bg-green-50 text-green-600 border-green-100'
                    }`}
                  >
                    #{pt.tags.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {filteredPosts.length === 0 && <div className="text-center text-gray-500 mt-20 font-medium">条件に合う思い出が見つかりません。</div>}
      </div>
    </main>
  );
}