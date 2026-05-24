"use client";

import { useEffect, useState, useRef } from 'react';
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

  // ★ 改修：単なるURLではなく「現在開いているチェキのインデックス（順番）」を管理する
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // ★ スマホでのスワイプ操作用の座標記録
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

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
          setAuthError(`アクセスが拒否されました。`);
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

  // ========================================================
  // ★ ギャラリー（Lightbox）操作のロジック
  // ========================================================

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (selectedIndex !== null && selectedIndex < filteredPosts.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  const handleClose = () => setSelectedIndex(null);

  // PCでのキーボード操作（Esc, 矢印キー）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null) return;
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, filteredPosts.length]);

  // スマホでのスワイプ操作
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchStartX.current - touchEndX;
    const deltaY = touchStartY.current - touchEndY;

    // 横移動の方が大きい場合（左右スワイプ）
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 50) handleNext(); // 左にスワイプ（次へ）
      else if (deltaX < -50) handlePrev(); // 右にスワイプ（前へ）
    } 
    // 縦移動の方が大きい場合（上下スワイプ）
    else {
      if (deltaY < -50) handleClose(); // 下にスワイプ（閉じる）
    }
  };

  // ========================================================

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
        
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wider">Cheki</h1>
          <div className="flex items-center gap-3">
            <NewPostModal onSuccess={fetchData} tags={tags} />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6 sm:mb-10 bg-slate-800 border border-slate-700 p-3 sm:p-4 rounded-none shadow-lg text-sm">
          <div className="flex justify-between items-center">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Filter:</span>
            {(selectedPeopleId || selectedEventId || selectedTime) && (
              <button onClick={handleResetFilter} className="sm:hidden text-[10px] sm:text-xs font-bold text-red-400 hover:text-red-300 underline transition">🔄 リセット</button>
            )}
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-slate-400 w-4 sm:w-5 text-center text-xs sm:text-sm">📅</span>
            <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} className="flex-1 sm:w-auto border border-slate-600 p-1.5 sm:p-2 rounded-none bg-slate-700 text-white font-medium text-[10px] sm:text-xs">
              <option value="">すべての時期</option>
              {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-slate-400 w-4 sm:w-5 text-center text-xs sm:text-sm">👤</span>
            <select value={selectedPeopleId} onChange={(e) => setSelectedPeopleId(e.target.value)} className="flex-1 sm:w-auto border border-slate-600 p-1.5 sm:p-2 rounded-none bg-slate-700 text-white font-medium text-[10px] sm:text-xs">
              <option value="">すべての人物</option>
              {tags.filter(t => t.type === 'people').map(tag => <option key={tag.id} value={tag.id}>#{tag.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-slate-400 w-4 sm:w-5 text-center text-xs sm:text-sm">🏷️</span>
            <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="flex-1 sm:w-auto border border-slate-600 p-1.5 sm:p-2 rounded-none bg-slate-700 text-white font-medium text-[10px] sm:text-xs">
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

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-8">
          {/* ★ 改修：mapに index を渡し、クリック時にその index をセットする */}
          {filteredPosts.map((post, index) => (
            <div key={post.id} className="bg-white p-2 pb-14 sm:p-4 sm:pb-20 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 sm:hover:-translate-y-2 transition-all duration-300 relative rounded-none">
              
              <div 
                onClick={() => setSelectedIndex(index)}
                className="aspect-[3/4] bg-gray-200 mb-2 sm:mb-4 overflow-hidden rounded-none cursor-zoom-in relative select-none"
              >
                <img 
                  src={post.image_url} 
                  alt="チェキ" 
                  className="w-full h-full object-cover pointer-events-none" 
                  style={{ objectPosition: `${post.image_position}% center` }}
                />
              </div>

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

        {/* ========================================================
            ★ ギャラリー（Lightbox）カルーセルUI
            ======================================================== */}
        {selectedIndex !== null && filteredPosts[selectedIndex] && (
          <div 
            onClick={handleClose}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="fixed inset-0 bg-black z-50 flex items-center justify-center animate-fadeIn select-none"
          >
            {/* メイン写真（見切れなし・比率維持） */}
            <img 
              src={filteredPosts[selectedIndex].image_url} 
              alt="拡大画像" 
              className="max-w-full max-h-[100dvh] object-contain pointer-events-none"
            />

            {/* 閉じるボタン (PC/スマホ共通) */}
            <button 
              onClick={handleClose}
              className="absolute top-4 sm:top-6 right-4 sm:right-6 text-white bg-black bg-opacity-40 hover:bg-opacity-60 p-2 sm:p-3 rounded-full transition z-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {/* 戻る・次へボタン (PCでのみ表示、スマホはスワイプ操作のため非表示) */}
            {selectedIndex > 0 && (
              <button onClick={handlePrev} className="hidden sm:block absolute left-6 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-30 hover:bg-opacity-60 p-4 rounded-full transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
            )}
            {selectedIndex < filteredPosts.length - 1 && (
              <button onClick={handleNext} className="hidden sm:block absolute right-6 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-30 hover:bg-opacity-60 p-4 rounded-full transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            )}

            {/* 情報オーバーレイ（下部の黒いグラデーションに乗せる） */}
            <div 
              onClick={(e) => e.stopPropagation()} // 文字をタップしても閉じないようにする
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-6 sm:p-10 pt-20"
            >
              <div className="max-w-3xl mx-auto flex flex-col gap-3">
                {/* コメント */}
                {filteredPosts[selectedIndex].comment && (
                  <p className="text-white text-sm sm:text-lg font-medium leading-relaxed whitespace-pre-wrap">
                    {filteredPosts[selectedIndex].comment}
                  </p>
                )}
                
                {/* 日付とタグ */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
                  <span className="text-gray-300 font-mono text-sm tracking-widest font-bold">
                    {filteredPosts[selectedIndex].date?.replace(/-/g, '.')}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {filteredPosts[selectedIndex].post_tags?.map((pt, i) => pt.tags && (
                      <span key={i} className={`text-xs font-bold px-2 py-1 rounded-none shadow-sm ${pt.tags.type === 'people' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}>
                        #{pt.tags.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </main>
  );
}