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

// ==========================================
// ★ あなたのGoogleアカウント
// ==========================================
const ALLOWED_ADMIN_EMAIL = "yuno.crescent25@gmail.com"; 

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  
  // 3軸のフィルター状態管理
  const [selectedPeopleId, setSelectedPeopleId] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>(""); 
  
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // ギャラリー（全画面表示）の状態管理
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // スマホのスワイプ操作用
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

  // --- 削除ロジック ---
  const handleDelete = async (post: Post) => {
    if (!confirm("この思い出を完全に削除してもよろしいですか？")) return;
    try {
      // 1. 中間テーブルの削除
      await supabase.from('post_tags').delete().eq('post_id', post.id);
      // 2. 投稿の削除
      await supabase.from('posts').delete().eq('id', post.id);
      // 3. ストレージから画像を削除
      const fileName = post.image_url.split('/').pop();
      if (fileName) {
        await supabase.storage.from('photos').remove([fileName]);
      }
      // 4. ステート更新
      setPosts(posts.filter(p => p.id !== post.id));
      setSelectedIndex(null); // モーダルを閉じる
    } catch (error) {
      console.error(error);
      alert("削除に失敗しました。");
    }
  };

  // --- ギャラリー操作ロジック ---
  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (selectedIndex !== null && selectedIndex > 0) setSelectedIndex(selectedIndex - 1);
  };
  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (selectedIndex !== null && selectedIndex < filteredPosts.length - 1) setSelectedIndex(selectedIndex + 1);
  };
  const handleClose = () => setSelectedIndex(null);

  // 時期フィルターの選択肢生成
  const timeOptions: { label: string; value: string }[] = [];
  const yearSet = new Set<string>();
  const yearMonthSet = new Set<string>();
  posts.forEach(post => {
    if (post.date) {
      yearSet.add(post.date.substring(0, 4));
      yearMonthSet.add(post.date.substring(0, 7));
    }
  });
  Array.from(yearSet).sort().reverse().forEach(year => {
    timeOptions.push({ label: `${year}年 (すべて)`, value: year });
    Array.from(yearMonthSet).filter(ym => ym.startsWith(year)).sort().reverse().forEach(ym => {
      timeOptions.push({ label: ` ${year}.${ym.substring(5, 7)}`, value: ym }); 
    });
  });

  // フィルター実行
  const filteredPosts = posts.filter(post => {
    if (selectedPeopleId && !post.post_tags?.some(pt => String(pt.tags?.id) === String(selectedPeopleId))) return false;
    if (selectedEventId && !post.post_tags?.some(pt => String(pt.tags?.id) === String(selectedEventId))) return false;
    if (selectedTime && (!post.date || !post.date.startsWith(selectedTime))) return false;
    return true;
  });

  const handleResetFilter = () => {
    setSelectedPeopleId(""); setSelectedEventId(""); setSelectedTime("");
  };

  // 背景スクロール禁止
  useEffect(() => {
    document.body.style.overflow = selectedIndex !== null ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedIndex]);

  // キーボード操作
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

  if (loading && session) return <div className="min-h-screen bg-slate-900 p-8 text-center text-slate-400 font-medium">読み込み中...</div>;

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
        <div className="bg-white p-8 rounded-none shadow-2xl max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2 tracking-wider">Cheki</h1>
          <button onClick={signInWithGoogle} className="w-full bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-none shadow-sm hover:bg-gray-50 transition flex items-center justify-center gap-3 font-bold text-base">Googleでログイン</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 p-3 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wider">Cheki</h1>
          <NewPostModal onSuccess={fetchData} tags={tags} />
        </div>

        {/* フィルターエリア */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6 sm:mb-10 bg-slate-800 border border-slate-700 p-3 sm:p-4 rounded-none shadow-lg text-sm">
          <div className="flex justify-between items-center">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Filter:</span>
            {(selectedPeopleId || selectedEventId || selectedTime) && (
              <button onClick={handleResetFilter} className="sm:hidden text-[10px] sm:text-xs font-bold text-red-400 underline transition">🔄 リセット</button>
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
            <button onClick={handleResetFilter} className="hidden sm:block text-xs font-bold text-red-400 underline ml-auto transition">🔄 フィルターをリセット</button>
          )}
        </div>

        {/* タイムライン */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-8">
          {filteredPosts.map((post, index) => (
            <div key={post.id} className="bg-white p-2 pb-14 sm:p-4 sm:pb-20 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 sm:hover:-translate-y-2 transition-all duration-300 relative rounded-none">
              <div onClick={() => setSelectedIndex(index)} className="aspect-[3/4] bg-gray-200 mb-2 sm:mb-4 overflow-hidden rounded-none cursor-zoom-in relative select-none">
                <img src={post.image_url} className="w-full h-full object-cover" style={{ objectPosition: `${post.image_position}% center` }} />
              </div>
              <div className="text-gray-800 font-medium text-xs sm:text-lg leading-relaxed mb-2 sm:mb-3 whitespace-pre-wrap line-clamp-3 sm:line-clamp-none">{post.comment}</div>
              <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-5 text-gray-400 font-mono text-[9px] sm:text-sm tracking-tighter italic font-bold">{post.date ? post.date.replace(/-/g, '.') : '----.--.--'}</div>
              <div className="flex flex-wrap gap-0.5 sm:gap-1 absolute bottom-2 left-2 sm:bottom-4 sm:left-4 max-w-[85%] sm:max-w-[70%]">
                {post.post_tags?.map((pt, i) => pt.tags && (
                  <span key={i} className={`text-[8px] sm:text-[10px] font-bold px-1 py-0.5 sm:px-1.5 rounded-none border shadow-sm ${pt.tags.type === 'people' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-green-50 text-green-600 border-green-100'}`}>#{pt.tags.name}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ギャラリー（Lightbox） */}
        {selectedIndex !== null && filteredPosts[selectedIndex] && (
          <div 
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY; }}
            onTouchEnd={(e) => {
              const deltaX = touchStartX.current - e.changedTouches[0].clientX;
              const deltaY = touchStartY.current - e.changedTouches[0].clientY;
              if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (deltaX > 50) handleNext(); else if (deltaX < -50) handlePrev();
              } else if (deltaY < -50) handleClose();
            }}
            className="fixed inset-0 bg-black z-50 flex items-center justify-center animate-fadeIn select-none"
          >
            <img src={filteredPosts[selectedIndex].image_url} className="max-w-full max-h-[100dvh] object-contain pointer-events-none" />
            
            <div className="absolute top-4 sm:top-6 right-4 sm:right-6 flex gap-3 z-50">
              {/* 削除ボタン */}
              <button onClick={(e) => { e.stopPropagation(); handleDelete(filteredPosts[selectedIndex]); }} className="bg-red-600 text-white p-3 rounded-none shadow-xl hover:bg-red-700 transition">🗑️</button>
              {/* 閉じるボタン */}
              <button onClick={(e) => { e.stopPropagation(); handleClose(); }} className="text-white bg-black bg-opacity-40 hover:bg-opacity-60 p-3 rounded-none transition">✕</button>
            </div>

            {/* 情報オーバーレイ */}
            <div onClick={(e) => e.stopPropagation()} className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-6 sm:p-10 pt-20">
              <div className="max-w-3xl mx-auto flex flex-col gap-3">
                <p className="text-white text-sm sm:text-lg font-medium leading-relaxed whitespace-pre-wrap">{filteredPosts[selectedIndex].comment}</p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
                  <span className="text-gray-300 font-mono text-sm tracking-widest font-bold">{filteredPosts[selectedIndex].date?.replace(/-/g, '.')}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {filteredPosts[selectedIndex].post_tags?.map((pt, i) => pt.tags && (
                      <span key={i} className={`text-xs font-bold px-2 py-1 rounded-none shadow-sm ${pt.tags.type === 'people' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}>#{pt.tags.name}</span>
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