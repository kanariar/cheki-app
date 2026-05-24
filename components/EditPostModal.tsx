"use client";

import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import exifr from 'exifr';

interface Tag { id: any; name: string; type: string; }
interface Post { 
  id: string; 
  image_url: string; 
  comment: string; 
  date: string; 
  image_position: number;
  post_tags: { tags: { id: string; name: string; type: string } }[]; 
}

interface EditPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tags: Tag[];
  post: Post | null;
}

export default function EditPostModal({ isOpen, onClose, onSuccess, tags, post }: EditPostModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");
  const [date, setDate] = useState("");
  const [imagePosition, setImagePosition] = useState<number>(50);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // ★ 既存データの読み込み
  useEffect(() => {
    if (post && isOpen) {
      setPreviewUrl(post.image_url);
      setComment(post.comment || "");
      setDate(post.date || new Date().toISOString().split('T')[0]);
      setImagePosition(post.image_position ?? 50);
      
      const people = post.post_tags.filter(pt => pt.tags?.type === 'people').map(pt => pt.tags.id);
      const events = post.post_tags.filter(pt => pt.tags?.type === 'event').map(pt => pt.tags.id);
      setSelectedPeopleIds(people);
      setSelectedEventIds(events);
      
      setFile(null);
      setAddedPeopleNames([]);
      setAddedEventNames([]);
    }
  }, [post, isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (peopleRef.current && !peopleRef.current.contains(e.target as Node)) setShowPeopleList(false);
      if (eventRef.current && !eventRef.current.contains(e.target as Node)) setShowEventList(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen || !post) return null;

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setImagePosition(50);
      try {
        const exifData = await exifr.parse(selectedFile);
        if (exifData && exifData.DateTimeOriginal) {
          const dateObj = new Date(exifData.DateTimeOriginal);
          setDate(`${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`);
        }
      } catch (error) {
        console.log("Exifスキップ");
      }
    }
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true;
    startX.current = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startPos.current = imagePosition;
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const walk = ((clientX - startX.current) / containerRef.current.offsetWidth) * 100 * 0.15;
    let newPos = startPos.current - walk;
    if (newPos < 0) newPos = 0;
    if (newPos > 100) newPos = 100;
    setImagePosition(Math.round(newPos));
  };

  const handleDragEnd = () => { isDragging.current = false; };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      let finalImageUrl = post.image_url;

      // 写真が新しく選ばれた場合のみアップロード処理
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('photos').upload(fileName, file);
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage.from('photos').getPublicUrl(fileName);
        finalImageUrl = publicUrlData.publicUrl;

        // 古い画像をストレージから削除（エラーが起きても無視する）
        const oldFileName = post.image_url.split('/').pop();
        if (oldFileName) supabase.storage.from('photos').remove([oldFileName]).catch(()=>console.log("旧画像削除スキップ"));
      }

      // 1. 投稿データの上書き (UPDATE)
      const { error: updateError } = await supabase.from('posts').update({
        image_url: finalImageUrl,
        comment: comment,
        date: date,
        image_position: imagePosition,
      }).eq('id', post.id);

      if (updateError) throw updateError;

      // 2. タグの再構築（一旦すべて消して、新しく入れ直すのが一番安全）
      await supabase.from('post_tags').delete().eq('post_id', post.id);

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
        await supabase.from('post_tags').insert({ post_id: post.id, tag_id: tagId });
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      alert(`保存に失敗しました: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelection = (id: string, type: 'people' | 'event') => {
    if (type === 'people') {
      setSelectedPeopleIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
      setPeopleInput(""); setShowPeopleList(false);
    } else {
      setSelectedEventIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
      setEventInput(""); setShowEventList(false);
    }
  };

  const createNewTag = (name: string, type: 'people' | 'event') => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (type === 'people') {
      if (!addedPeopleNames.includes(trimmed)) setAddedPeopleNames([...addedPeopleNames, trimmed]);
      setPeopleInput(""); setShowPeopleList(false);
    } else {
      if (!addedEventNames.includes(trimmed)) setAddedEventNames([...addedEventNames, trimmed]);
      setEventInput(""); setShowEventList(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[60] p-2" onClick={onClose}>
      <div className="bg-white rounded-none shadow-2xl w-full max-w-4xl max-h-[95dvh] flex flex-col py-4 sm:py-6 relative" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl sm:text-2xl font-bold mb-4 px-4 sm:px-8 text-gray-900 flex-shrink-0">思い出を編集</h2>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 overflow-y-auto px-4 sm:px-8 pb-4">
          
          <div className="md:col-span-5 flex flex-col gap-4">
            <div ref={containerRef} onMouseDown={handleDragStart} onMouseMove={handleDragMove} onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd} onTouchStart={handleDragStart} onTouchMove={handleDragMove} onTouchEnd={handleDragEnd} className="aspect-[3/4] w-full max-w-[200px] mx-auto bg-gray-100 flex items-center justify-center overflow-hidden rounded-none border border-gray-200 shadow-inner flex-shrink-0 cursor-ew-resize select-none relative">
              {previewUrl && (
                <>
                  <img src={previewUrl} alt="プレビュー" className="w-full h-full object-cover pointer-events-none" style={{ objectPosition: `${imagePosition}% center` }} />
                  <div className="absolute bottom-2 left-2 right-2 bg-black bg-opacity-50 text-white text-[9px] text-center py-1 rounded-sm pointer-events-none tracking-tighter">左右にスライドして位置調整</div>
                </>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Photo (変更する場合のみ)</label>
              <input type="file" accept="image/*" onChange={handleImageChange} className="text-xs text-gray-900 file:mr-3 file:py-1.5 file:px-3 file:rounded-none file:border-0 file:text-[10px] file:font-bold file:bg-gray-100 file:text-gray-700 cursor-pointer" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-gray-300 p-2 rounded-none focus:ring-2 focus:ring-inset focus:ring-slate-800 text-sm bg-white text-gray-900" />
            </div>
          </div>

          <div className="md:col-span-7 flex flex-col gap-6">
            <div className="flex flex-col gap-1.5 relative" ref={peopleRef}>
              <label className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">👤 Who (People)</label>
              <div className="flex flex-wrap gap-1.5 mb-1">
                {selectedPeopleIds.map(id => {
                  const t = tags.find(tag => String(tag.id) === String(id));
                  return t && <span key={id} className="inline-flex items-center bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-none shadow-sm">#{t.name} <button onClick={() => setSelectedPeopleIds(prev => prev.filter(i => i !== id))} className="ml-1 text-blue-200">×</button></span>;
                })}
                {addedPeopleNames.map(name => <span key={name} className="inline-flex items-center bg-cyan-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-none shadow-sm">#{name} (新) <button onClick={() => setAddedPeopleNames(prev => prev.filter(n => n !== name))} className="ml-1 text-cyan-200">×</button></span>)}
              </div>
              <input type="text" placeholder="名前を検索、または入力して追加..." value={peopleInput} onFocus={() => setShowPeopleList(true)} onChange={(e) => setPeopleInput(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-none text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              {showPeopleList && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-none shadow-xl max-h-48 overflow-y-auto">
                  {tags.filter(t => t.type === 'people' && t.name.includes(peopleInput)).map(t => (
                    <button key={t.id} onClick={() => toggleSelection(t.id, 'people')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex justify-between items-center">
                      <span className="text-gray-900">#{t.name}</span>{selectedPeopleIds.includes(t.id) && <span className="text-blue-600 text-xs">✓</span>}
                    </button>
                  ))}
                  {peopleInput.trim() && !tags.some(t => t.type === 'people' && t.name === peopleInput.trim()) && (
                    <button onClick={() => createNewTag(peopleInput, 'people')} className="w-full text-left px-4 py-3 text-sm text-blue-600 font-bold bg-blue-50 hover:bg-blue-100 border-t border-blue-100">✨ "{peopleInput}" を新しく追加する</button>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5 relative" ref={eventRef}>
              <label className="text-xs font-bold text-green-600 uppercase tracking-wider flex items-center gap-1">🏷️ What / Where (Event)</label>
              <div className="flex flex-wrap gap-1.5 mb-1">
                {selectedEventIds.map(id => {
                  const t = tags.find(tag => String(tag.id) === String(id));
                  return t && <span key={id} className="inline-flex items-center bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-none shadow-sm">#{t.name} <button onClick={() => setSelectedEventIds(prev => prev.filter(i => i !== id))} className="ml-1 text-green-200">×</button></span>;
                })}
                {addedEventNames.map(name => <span key={name} className="inline-flex items-center bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-none shadow-sm">#{name} (新) <button onClick={() => setAddedEventNames(prev => prev.filter(n => n !== name))} className="ml-1 text-emerald-200">×</button></span>)}
              </div>
              <input type="text" placeholder="イベントを検索、または入力して追加..." value={eventInput} onFocus={() => setShowEventList(true)} onChange={(e) => setEventInput(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-none text-sm text-gray-900 focus:ring-2 focus:ring-green-500 focus:outline-none" />
              {showEventList && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-none shadow-xl max-h-48 overflow-y-auto">
                  {tags.filter(t => t.type === 'event' && t.name.includes(eventInput)).map(t => (
                    <button key={t.id} onClick={() => toggleSelection(t.id, 'event')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex justify-between items-center">
                      <span className="text-gray-900">#{t.name}</span>{selectedEventIds.includes(t.id) && <span className="text-green-600 text-xs">✓</span>}
                    </button>
                  ))}
                  {eventInput.trim() && !tags.some(t => t.type === 'event' && t.name === eventInput.trim()) && (
                    <button onClick={() => createNewTag(eventInput, 'event')} className="w-full text-left px-4 py-3 text-sm text-green-600 font-bold bg-green-50 hover:bg-green-100 border-t border-green-100">✨ "{eventInput}" を新しく追加する</button>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Comment</label>
              <textarea placeholder="メモを自由に記入..." value={comment} onChange={(e) => setComment(e.target.value)} className="w-full border border-gray-300 p-3 rounded-none text-sm focus:ring-2 focus:ring-inset focus:ring-slate-800 text-gray-900 bg-white flex-1 min-h-[100px]" />
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 px-6 sm:px-8 flex-shrink-0">
          <button onClick={onClose} disabled={isSubmitting} className="px-5 py-2 bg-gray-200 text-gray-700 rounded-none hover:bg-gray-300 transition font-bold text-xs">キャンセル</button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="px-8 py-2 bg-slate-800 text-white rounded-none hover:bg-slate-700 transition font-bold text-xs">
            {isSubmitting ? "更新中..." : "変更を保存"}
          </button>
        </div>
      </div>
    </div>
  );
}