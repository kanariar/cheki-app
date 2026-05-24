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
  image_position: number; 
  post_tags: { tags: { id: string; name: string; type: string } }[]; 
}
interface Tag { id: string; name: string; type: string; }

// ==========================================
// ★ あなたのGoogleアカウント
// ==========================================
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

  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: postsData } = await supabase
        .from('posts')
        .select(`id, image_url, comment, date, created_at, image_position, post_tags (tags ( id, name, type ))`)
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

  const signOut = async () => { await supabase.auth.signOut(); };

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

  if (loading && session) return <div className="min-h-screen bg-slate-900 p-8 text-center text-slate-400 font-medium">読み込み中...</div>;

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
        <div className="bg-white p-8 rounded-none shadow-2xl max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2 tracking-wider">Cheki</h1>
          <p className="text-sm text-gray-500 mb-6">思い出を記録するプライベート空間</p>
          {authError && (
            <div className="bg-red-50 text-red-600 text-xs font-semibold p-3 rounded-xl mb-6 border border-red-200 text-left leading-relaxed animate-pulse">⚠️ {authError}</div>
          )}
          <button onClick={signInWithGoogle} className="w-full bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-none shadow-sm hover:bg-gray-50 transition flex items-center justify-center gap-3 font-bold text-base">
            Googleアカウントでログイン
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 p-3 sm:p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* ヘッダーエリア */}
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wider">Cheki</h1>
          <div className="flex items-center gap-3">
            <NewPostModal onSuccess={fetchData} tags={tags} />
          </div>
        </div>

        {/* フィルターエリア */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6 sm:mb-10 bg-slate-800 border border-slate-700 p-3 sm:p-4 rounded-none shadow-lg text-sm">
          
          <div className="flex justify-between items-center">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Filter:</span>
            {(selectedPeopleId || selectedEventId || selectedTime) && (
              <button onClick={handleResetFilter} className="sm:hidden text-[10px] sm:text-xs font-bold text-red-400 hover:text-red-300 underline transition">
                🔄 リセット
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-slate-400 w-4 sm:w-5 text-center text-xs sm:text-sm">📅</span>
            <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} className="flex-1 sm:w-auto border border-slate-600 p-1.5 sm:p-2 rounded-none bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-[10px] sm:text-xs">
              <option value="">すべての時期</option>
              {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-slate-400 w-4 sm:w-5 text-center text-xs sm:text-sm">👤</span>
            <select value={selectedPeopleId} onChange={(e) => setSelectedPeopleId(e.target.value)} className="flex-1 sm:w-auto border border-slate-600 p-1.5 sm:p-2 rounded-none bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-[10px] sm:text-xs">
              <option value="">すべての人物</option>
              {tags.filter(t => t.type === 'people').map(tag => <option key={tag.id} value={tag.id}>#{tag.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-slate-400 w-4 sm:w-5 text-center text-xs sm:text-sm">🏷️</span>
            <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="flex-1 sm:w-auto border border-slate-600 p-1.5 sm:p-2 rounded-none bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-[10px] sm:text-xs">
              <option value="">すべてのイベント</option>
              {tags.filter(t => t.type === 'event').map(tag => <option key={tag.id} value={tag.id}>#{tag.name}</option>)}
            </select>
          </div>

          {(selectedPeopleId || selectedEventId || selectedTime) && (
            <button onClick={handleResetFilter} className="hidden sm:block text-xs font-bold text-red-400 hover:text-red-300 underline ml-auto transition">
              🔄 フィルターをリセット
            </button>
          )}
        </div>

        {/* タイムライン：スマホは grid-cols-2、PCは grid-cols-3 にし、隙間(gap)もスマホ向けに狭く */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-8">
          {filteredPosts.map((post) => (
            /* スマホ用の余白(p-2 pb-14)とPC用の余白(sm:p-4 sm:pb-20)を使い分け */
            <div key={post.id} className="bg-white p-2 pb-14 sm:p-4 sm:pb-20 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 sm:hover:-translate-y-2 transition-all duration-300 relative rounded-none">
              
              <div 
                onClick={() => setZoomImageUrl(post.image_url)}
                className="aspect-[3/4] bg-gray-200 mb-2 sm:mb-4 overflow-hidden rounded-none cursor-zoom-in relative select-none"
              >
                <img 
                  src={post.image_url} 
                  alt="チェキ" 
                  className="w-full h-full object-cover pointer-events-none" 
                  style={{ objectPosition: `${post.image_position}% center` }}
                />
              </div>

              {/* コメントの文字サイズもスマホ用(text-xs)とPC用(text-lg)で可変に */}
              <div className="text-gray-800 font-medium text-xs sm:text-lg leading-relaxed mb-2 sm:mb-3 whitespace-pre-wrap line-clamp-3 sm:line-clamp-none">{post.comment}</div>
              
              <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-5 text-gray-400 font-mono text-[9px] sm:text-sm tracking-tighter italic font-bold">
                {post.date ? post.date.replace(/-/g, '.') : '----.--.--'}
              </div>

              <div className="flex flex-wrap gap-0.5 sm:gap-1 absolute bottom-2 left-2 sm:bottom-4 sm:left-4 max-w-[85%] sm:max-w-[70%]">
                {post.post_tags?.map((pt, i) => pt.tags && (
                  <span key={i} className={`text-[8px] sm:text-[10px] font-bold px-1 py-0.5 sm:px-1.5 rounded-none border shadow-sm ${pt.tags.type === 'people' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                    #{pt.tags.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {filteredPosts.length === 0 && <div className="text-center text-slate-400 mt-20 font-medium text-sm sm:text-base">条件に合う思い出が見つかりません。</div>}

        {/* 全画面拡大表示用モーダル */}
        {zoomImageUrl && (
          <div 
            onClick={() => setZoomImageUrl(null)}
            className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4 cursor-zoom-out animate-fadeIn animate-duration-200"
          >
            <img 
              src={zoomImageUrl} 
              alt="拡大画像" 
              className="max-w-full max-h-full object-contain shadow-2xl select-none"
            />
            <div className="absolute top-4 right-4 text-white font-bold bg-slate-800 bg-opacity-50 px-3 py-1.5 rounded-full text-xs">
              タップして閉じる
            </div>
          </div>
        )}

      </div>
    </main>
  );
}