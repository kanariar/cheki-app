"use client";

import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Tag { id: any; name: string; type: string; }
interface NewPostModalProps { onSuccess: () => void; tags: Tag[]; googleToken: string | null; }

export default function NewPostModal({ onSuccess, tags, googleToken }: NewPostModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePosition, setImagePosition] = useState<number>(50);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startPos = useRef(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [addedPeopleNames, setAddedPeopleNames] = useState<string[]>([]);
  const [addedEventNames, setAddedEventNames] = useState<string[]>([]);
  const [peopleInput, setPeopleInput] = useState("");
  const [eventInput, setEventInput] = useState("");
  const [showPeopleList, setShowPeopleList] = useState(false);
  const [showEventList, setShowEventList] = useState(false);

  const peopleRef = useRef<HTMLDivElement>(null);
  const eventRef = useRef<HTMLDivElement>(null);

  const [pickerSessionId, setPickerSessionId] = useState<string | null>(null);
  const [isWaitingPicker, setIsWaitingPicker] = useState(false);

  // 一時保存データの復元
  useEffect(() => {
    if (googleToken) {
      const savedDraft = localStorage.getItem('cheki_draft');
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          if (draft.pickerSessionId) {
            setIsOpen(true);
            setComment(draft.comment || "");
            if (draft.date) setDate(draft.date);
            setSelectedPeopleIds(draft.selectedPeopleIds || []);
            setSelectedEventIds(draft.selectedEventIds || []);
            setAddedPeopleNames(draft.addedPeopleNames || []);
            setAddedEventNames(draft.addedEventNames || []);
            setPickerSessionId(draft.pickerSessionId);
            setIsWaitingPicker(true);
          }
        } catch (e) {
          console.error("Draft parse error", e);
        }
      }
    }
  }, [googleToken]);

  const openGooglePicker = async () => {
    if (!googleToken) { alert("ログインし直してください"); return; }
    try {
      setIsWaitingPicker(true);
      const res = await fetch('/api/google-photos', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${googleToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "セッション作成失敗");

      const sessionId = data.id;
      setPickerSessionId(sessionId);
      
      const draft = {
          comment,
          date,
          selectedPeopleIds,
          selectedEventIds,
          addedPeopleNames,
          addedEventNames,
          pickerSessionId: sessionId
      };
      localStorage.setItem('cheki_draft', JSON.stringify(draft));
      
      window.open(data.pickerUri, '_blank');
      
    } catch(e: any) {
      alert(`エラー: ${e.message}`);
      setIsWaitingPicker(false);
    }
  };

  // Googleでの写真選択を待つポーリング処理
  useEffect(() => {
    if (!isWaitingPicker || !pickerSessionId || !googleToken) return;

    const checkSession = async () => {
      try {
        const res = await fetch(`/api/google-photos?sessionId=${pickerSessionId}&action=status`, {
          headers: { 'Authorization': `Bearer ${googleToken}` }
        });
        const data = await res.json();
        
        // ユーザーが写真を選んで戻ってきた！
        if (data.mediaItemsSet) {
          const itemsRes = await fetch(`/api/google-photos?sessionId=${pickerSessionId}&action=items`, {
            headers: { 'Authorization': `Bearer ${googleToken}` }
          });
          const itemsData = await itemsRes.json();
          
          if (itemsData.mediaItems && itemsData.mediaItems.length > 0) {
            const photo = itemsData.mediaItems[0];
            const downloadUrl = `${photo.mediaFile.baseUrl}=w600-h800`;
            
            // ★ 修正：中継API（proxy-image）に対しても、Googleの合鍵（Authorization）を渡して引き抜く！
            const proxyRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(downloadUrl)}`, {
              headers: { 'Authorization': `Bearer ${googleToken}` }
            });
            
            if (!proxyRes.ok) throw new Error("画像のダウンロードに失敗しました");
            
            const blob = await proxyRes.blob();
            const googleFile = new File([blob], "google-photo.jpg", { type: "image/jpeg" });
            
            setFile(googleFile);
            setPreviewUrl(URL.createObjectURL(googleFile));
            setImagePosition(50);
            
            if (photo.createTime) {
                setDate(photo.createTime.split('T')[0]);
            }

            setIsWaitingPicker(false);
            setPickerSessionId(null);
            
            localStorage.removeItem('cheki_draft');
          }
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    };

    checkSession(); 
    const interval = setInterval(checkSession, 3000);

    return () => clearInterval(interval);
  }, [isWaitingPicker, pickerSessionId, googleToken]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (peopleRef.current && !peopleRef.current.contains(e.target as Node)) setShowPeopleList(false);
      if (eventRef.current && !eventRef.current.contains(e.target as Node)) setShowEventList(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile); setPreviewUrl(URL.createObjectURL(selectedFile)); setImagePosition(50);
    }
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!previewUrl) return;
    isDragging.current = true;
    startX.current = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startPos.current = imagePosition;
  };
  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const walk = ((clientX - startX.current) / containerRef.current.offsetWidth) * 100 * 0.15;
    let newPos = startPos.current - walk;
    if (newPos < 0) newPos = 0; if (newPos > 100) newPos = 100;
    setImagePosition(Math.round(newPos));
  };
  const handleDragEnd = () => { isDragging.current = false; };

  const closeModal = () => {
    setIsOpen(false); setPreviewUrl(null); setFile(null); setComment(""); setDate(new Date().toISOString().split('T')[0]); 
    setImagePosition(50); setSelectedPeopleIds([]); setSelectedEventIds([]); setAddedPeopleNames([]); setAddedEventNames([]);
    setPeopleInput(""); setEventInput(""); setIsSubmitting(false); setIsWaitingPicker(false); setPickerSessionId(null);
    localStorage.removeItem('cheki_draft');
  };

  const handleSubmit = async () => {
    if (!file) { alert("画像を選択してください"); return; }
    try {
      setIsSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("認証失敗");

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('photos').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('photos').getPublicUrl(fileName);
      const { data: newPost, error: insertError } = await supabase.from('posts').insert({
          user_id: user.id, image_url: publicUrlData.publicUrl, comment: comment, date: date, image_position: imagePosition, 
        }).select().single();

      if (insertError) throw insertError;

      if (newPost) {
        const finalTagIds = [...selectedPeopleIds, ...selectedEventIds];
        for (const name of addedPeopleNames) {
          const { data: tagData } = await supabase.from('tags').upsert({ name, type: 'people' }, { onConflict: 'name' }).select().single();
          if (tagData) finalTagIds.push(tagData.id);
        }
        for (const name of addedEventNames) {
          const { data: tagData } = await supabase.from('tags').upsert({ name, type: 'event' }, { onConflict: 'name' }).select().single();
          if (tagData) finalTagIds.push(tagData.id);
        }
        for (const tagId of finalTagIds) {
          await supabase.from('post_tags').insert({ post_id: newPost.id, tag_id: tagId });
        }
      }
      closeModal(); onSuccess(); 
    } catch (error: any) {
      alert(`保存失敗: ${error.message}`);
    } finally { setIsSubmitting(false); }
  };

  const toggleSelection = (id: string, type: 'people' | 'event') => {
    if (type === 'people') { setSelectedPeopleIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); setPeopleInput(""); setShowPeopleList(false); } 
    else { setSelectedEventIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); setEventInput(""); setShowEventList(false); }
  };

  const createNewTag = (name: string, type: 'people' | 'event') => {
    const trimmed = name.trim(); if (!trimmed) return;
    if (type === 'people') { if (!addedPeopleNames.includes(trimmed)) setAddedPeopleNames([...addedPeopleNames, trimmed]); setPeopleInput(""); setShowPeopleList(false); } 
    else { if (!addedEventNames.includes(trimmed)) setAddedEventNames([...addedEventNames, trimmed]); setEventInput(""); setShowEventList(false); }
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="bg-slate-700 text-white px-4 py-2 rounded-none shadow-md hover:bg-slate-600 transition font-bold text-sm">＋ 新規</button>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-2">
          <div className="bg-white rounded-none shadow-2xl w-full max-w-4xl max-h-[95dvh] flex flex-col py-4 sm:py-6 relative">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 px-4 sm:px-8 text-gray-900 flex-shrink-0">新しい思い出を登録</h2>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 overflow-y-auto px-4 sm:px-8 pb-4">
              <div className="md:col-span-5 flex flex-col gap-4">
                <div ref={containerRef} onMouseDown={handleDragStart} onMouseMove={handleDragMove} onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd} onTouchStart={handleDragStart} onTouchMove={handleDragMove} onTouchEnd={handleDragEnd} className="aspect-[3/4] w-full max-w-[200px] mx-auto bg-gray-100 flex items-center justify-center overflow-hidden rounded-none border border-gray-200 shadow-inner flex-shrink-0 cursor-ew-resize select-none relative">
                  {previewUrl ? (
                    <><img src={previewUrl} className="w-full h-full object-cover pointer-events-none" style={{ objectPosition: `${imagePosition}% center` }} /><div className="absolute bottom-2 left-2 right-2 bg-black bg-opacity-50 text-white text-[9px] text-center py-1 rounded-sm pointer-events-none tracking-tighter">左右にスライドして位置調整</div></>
                  ) : <span className="text-gray-400 text-sm">画像を選択</span>}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Photo</label>
                  {googleToken && (
                    <button 
                      type="button"
                      onClick={openGooglePicker}
                      disabled={isWaitingPicker}
                      className="w-full bg-blue-50 text-blue-600 border border-blue-200 py-2 text-xs font-bold hover:bg-blue-100 transition rounded-none mb-1 flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.333 4.667h-5.333V10h5.333V4.667zM10 4.667H4.667V10H10V4.667zM10 14H4.667v5.333H10V14zm9.333 0h-5.333v5.333h5.333V14z"/></svg>
                      {isWaitingPicker ? "別画面で写真を選択中..." : "Googleフォトから選ぶ"}
                    </button>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageChange} className="text-xs text-gray-900 file:mr-3 file:py-1.5 file:px-3 file:rounded-none file:border-0 file:text-[10px] file:font-bold file:bg-gray-100 file:text-gray-700 cursor-pointer" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-gray-300 p-2 rounded-none focus:ring-2 focus:ring-inset focus:ring-slate-800 text-sm bg-white" />
                </div>
              </div>

              <div className="md:col-span-7 flex flex-col gap-6">
                <div className="flex flex-col gap-1.5 relative" ref={peopleRef}>
                  <label className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">👤 Who (People)</label>
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {selectedPeopleIds.map(id => { const t = tags.find(tag => String(tag.id) === String(id)); return t && <span key={id} className="inline-flex items-center bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-none shadow-sm">#{t.name} <button onClick={() => setSelectedPeopleIds(prev => prev.filter(i => i !== id))} className="ml-1 text-blue-200">×</button></span>; })}
                    {addedPeopleNames.map(name => <span key={name} className="inline-flex items-center bg-cyan-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-none shadow-sm">#{name} (新) <button onClick={() => setAddedPeopleNames(prev => prev.filter(n => n !== name))} className="ml-1 text-cyan-200">×</button></span>)}
                  </div>
                  <input type="text" placeholder="名前を検索、または入力して追加..." value={peopleInput} onFocus={() => setShowPeopleList(true)} onChange={(e) => setPeopleInput(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-none text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  {showPeopleList && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-none shadow-xl max-h-48 overflow-y-auto">
                      {tags.filter(t => t.type === 'people' && t.name.includes(peopleInput)).map(t => (<button key={t.id} onClick={() => toggleSelection(t.id, 'people')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex justify-between items-center"><span>#{t.name}</span>{selectedPeopleIds.includes(t.id) && <span className="text-blue-600 text-xs">✓</span>}</button>))}
                      {peopleInput.trim() && !tags.some(t => t.type === 'people' && t.name === peopleInput.trim()) && (<button onClick={() => createNewTag(peopleInput, 'people')} className="w-full text-left px-4 py-3 text-sm text-blue-600 font-bold bg-blue-50 hover:bg-blue-100 border-t border-blue-100">✨ "{peopleInput}" を新しく追加する</button>)}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 relative" ref={eventRef}>
                  <label className="text-xs font-bold text-green-600 uppercase tracking-wider flex items-center gap-1">🏷️ What / Where (Event)</label>
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {selectedEventIds.map(id => { const t = tags.find(tag => String(tag.id) === String(id)); return t && <span key={id} className="inline-flex items-center bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-none shadow-sm">#{t.name} <button onClick={() => setSelectedEventIds(prev => prev.filter(i => i !== id))} className="ml-1 text-green-200">×</button></span>; })}
                    {addedEventNames.map(name => <span key={name} className="inline-flex items-center bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-none shadow-sm">#{name} (新) <button onClick={() => setAddedEventNames(prev => prev.filter(n => n !== name))} className="ml-1 text-emerald-200">×</button></span>)}
                  </div>
                  <input type="text" placeholder="イベントを検索、または入力して追加..." value={eventInput} onFocus={() => setShowEventList(true)} onChange={(e) => setEventInput(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-none text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                  {showEventList && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-none shadow-xl max-h-48 overflow-y-auto">
                      {tags.filter(t => t.type === 'event' && t.name.includes(eventInput)).map(t => (<button key={t.id} onClick={() => toggleSelection(t.id, 'event')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex justify-between items-center"><span>#{t.name}</span>{selectedEventIds.includes(t.id) && <span className="text-green-600 text-xs">✓</span>}</button>))}
                      {eventInput.trim() && !tags.some(t => t.type === 'event' && t.name === eventInput.trim()) && (<button onClick={() => createNewTag(eventInput, 'event')} className="w-full text-left px-4 py-3 text-sm text-green-600 font-bold bg-blue-50 hover:bg-blue-100 border-t border-blue-100">✨ "{eventInput}" を新しく追加する</button>)}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Comment</label>
                  <textarea placeholder="メモを自由に記入..." value={comment} onChange={(e) => setComment(e.target.value)} className="w-full border border-gray-300 p-3 rounded-none text-sm focus:ring-2 focus:ring-inset focus:ring-slate-800 bg-white flex-1 min-h-[100px]" />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 px-6 sm:px-8 flex-shrink-0">
              <button onClick={closeModal} disabled={isSubmitting} className="px-5 py-2 bg-gray-200 text-gray-700 rounded-none hover:bg-gray-300 transition font-bold text-xs">キャンセル</button>
              <button onClick={handleSubmit} disabled={isSubmitting} className="px-8 py-2 bg-slate-800 text-white rounded-none hover:bg-slate-700 transition font-bold text-xs">
                {isSubmitting ? "保存中..." : "保存する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}