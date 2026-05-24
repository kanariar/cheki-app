"use client";

import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import exifr from 'exifr';

interface Tag {
  id: any;
  name: string;
  type: string;
}

interface NewPostModalProps {
  onSuccess: () => void;
  tags: Tag[];
}

export default function NewPostModal({ onSuccess, tags }: NewPostModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 選択済みのタグ
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  // 新規作成予定のタグ名
  const [addedPeopleNames, setAddedPeopleNames] = useState<string[]>([]);
  const [addedEventNames, setAddedEventNames] = useState<string[]>([]);

  // 入力中のテキスト
  const [peopleInput, setPeopleInput] = useState("");
  const [eventInput, setEventInput] = useState("");
  // 候補リストの表示管理
  const [showPeopleList, setShowPeopleList] = useState(false);
  const [showEventList, setShowEventList] = useState(false);

  const peopleRef = useRef<HTMLDivElement>(null);
  const eventRef = useRef<HTMLDivElement>(null);

  // 外側をクリックしたらリストを閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (peopleRef.current && !peopleRef.current.contains(e.target as Node)) setShowPeopleList(false);
      if (eventRef.current && !eventRef.current.contains(e.target as Node)) setShowEventList(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      try {
        const exifData = await exifr.parse(selectedFile);
        if (exifData && exifData.DateTimeOriginal) {
          const dateObj = new Date(exifData.DateTimeOriginal);
          const yyyy = dateObj.getFullYear();
          const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
          const dd = String(dateObj.getDate()).padStart(2, '0');
          setDate(`${yyyy}-${mm}-${dd}`);
        }
      } catch (error) {
        console.log("Exifデータの取得をスキップしました");
      }
    }
  };

  const closeModal = () => {
    setIsOpen(false);
    setPreviewUrl(null);
    setFile(null);
    setComment("");
    setDate(new Date().toISOString().split('T')[0]);
    setSelectedPeopleIds([]);
    setSelectedEventIds([]);
    setAddedPeopleNames([]);
    setAddedEventNames([]);
    setPeopleInput("");
    setEventInput("");
    setIsSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!file) {
      alert("画像を選択してください");
      return;
    }
    try {
      setIsSubmitting(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("ユーザー認証情報の取得に失敗しました。");

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('photos').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('photos').getPublicUrl(fileName);
      const { data: newPost, error: insertError } = await supabase.from('posts').insert({
          user_id: user.id,
          image_url: publicUrlData.publicUrl,
          comment: comment,
          date: date,
        }).select().single();

      if (insertError) throw insertError;

      if (newPost) {
        const finalTagIds = [...selectedPeopleIds, ...selectedEventIds];
        
        // 人物新規保存
        for (const name of addedPeopleNames) {
          const { data: tagData } = await supabase.from('tags').upsert({ name, type: 'people' }, { onConflict: 'name' }).select().single();
          if (tagData) finalTagIds.push(tagData.id);
        }
        // イベント新規保存
        for (const name of addedEventNames) {
          const { data: tagData } = await supabase.from('tags').upsert({ name, type: 'event' }, { onConflict: 'name' }).select().single();
          if (tagData) finalTagIds.push(tagData.id);
        }

        for (const tagId of finalTagIds) {
          await supabase.from('post_tags').insert({ post_id: newPost.id, tag_id: tagId });
        }
      }
      closeModal();
      onSuccess(); 
    } catch (error: any) {
      alert(`保存に失敗しました。: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- タグ選択ロジック ---
  const toggleSelection = (id: string, type: 'people' | 'event') => {
    if (type === 'people') {
      setSelectedPeopleIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
      setPeopleInput("");
      setShowPeopleList(false);
    } else {
      setSelectedEventIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
      setEventInput("");
      setShowEventList(false);
    }
  };

  const createNewTag = (name: string, type: 'people' | 'event') => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (type === 'people') {
      if (!addedPeopleNames.includes(trimmed)) setAddedPeopleNames([...addedPeopleNames, trimmed]);
      setPeopleInput("");
      setShowPeopleList(false);
    } else {
      if (!addedEventNames.includes(trimmed)) setAddedEventNames([...addedEventNames, trimmed]);
      setEventInput("");
      setShowEventList(false);
    }
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="bg-gray-800 text-white px-4 py-2 rounded-full shadow-md hover:bg-gray-700 transition font-bold text-sm">
        ＋ 新規
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-2">
          {/* ★ dvh と 85dvh でスマホのキーボードやかぶりを防止 */}
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85dvh] flex flex-col py-4 sm:py-6 relative">
            
            <h2 className="text-xl sm:text-2xl font-bold mb-4 px-4 sm:px-8 text-gray-900 flex-shrink-0">新しい思い出を登録</h2>
            
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 overflow-y-auto px-4 sm:px-8 pb-4">
              
              {/* 【左カラム】 */}
              <div className="md:col-span-5 flex flex-col gap-4">
                <div className="aspect-[3/4] w-full max-w-[200px] mx-auto bg-gray-100 flex items-center justify-center overflow-hidden rounded border border-gray-200 shadow-inner flex-shrink-0">
                  {previewUrl ? <img src={previewUrl} alt="プレビュー" className="w-full h-full object-cover" /> : <span className="text-gray-400 text-sm">画像を選択</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Photo</label>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="text-xs text-gray-900 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-gray-100 file:text-gray-700 cursor-pointer" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-inset focus:ring-gray-800 text-sm bg-white" />
                </div>
              </div>

              {/* 【右カラム：Notion風タグ】 */}
              <div className="md:col-span-7 flex flex-col gap-6">
                
                {/* 人物タグ */}
                <div className="flex flex-col gap-1.5 relative" ref={peopleRef}>
                  <label className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">👤 Who (People)</label>
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {selectedPeopleIds.map(id => {
                      const t = tags.find(tag => String(tag.id) === String(id));
                      return t && (
                        <span key={id} className="inline-flex items-center bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                          #{t.name} <button onClick={() => setSelectedPeopleIds(prev => prev.filter(i => i !== id))} className="ml-1 text-blue-200 hover:text-white">×</button>
                        </span>
                      );
                    })}
                    {addedPeopleNames.map(name => (
                      <span key={name} className="inline-flex items-center bg-cyan-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        #{name} (新) <button onClick={() => setAddedPeopleNames(prev => prev.filter(n => n !== name))} className="ml-1 text-cyan-200 hover:text-white">×</button>
                      </span>
                    ))}
                  </div>
                  <input 
                    type="text" 
                    placeholder="名前を検索、または入力して追加..."
                    value={peopleInput}
                    onFocus={() => setShowPeopleList(true)}
                    onChange={(e) => setPeopleInput(e.target.value)}
                    className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  {showPeopleList && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {tags.filter(t => t.type === 'people' && t.name.includes(peopleInput)).map(t => (
                        <button key={t.id} onClick={() => toggleSelection(t.id, 'people')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex justify-between items-center">
                          <span>#{t.name}</span>
                          {selectedPeopleIds.includes(t.id) && <span className="text-blue-600 text-xs">✓</span>}
                        </button>
                      ))}
                      {peopleInput.trim() && !tags.some(t => t.type === 'people' && t.name === peopleInput.trim()) && (
                        <button onClick={() => createNewTag(peopleInput, 'people')} className="w-full text-left px-4 py-3 text-sm text-blue-600 font-bold bg-blue-50 hover:bg-blue-100 border-t border-blue-100">
                          ✨ "{peopleInput}" を新しく追加する
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* イベントタグ */}
                <div className="flex flex-col gap-1.5 relative" ref={eventRef}>
                  <label className="text-xs font-bold text-green-600 uppercase tracking-wider flex items-center gap-1">🏷️ What / Where (Event)</label>
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {selectedEventIds.map(id => {
                      const t = tags.find(tag => String(tag.id) === String(id));
                      return t && (
                        <span key={id} className="inline-flex items-center bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                          #{t.name} <button onClick={() => setSelectedEventIds(prev => prev.filter(i => i !== id))} className="ml-1 text-green-200 hover:text-white">×</button>
                        </span>
                      );
                    })}
                    {addedEventNames.map(name => (
                      <span key={name} className="inline-flex items-center bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        #{name} (新) <button onClick={() => setAddedEventNames(prev => prev.filter(n => n !== name))} className="ml-1 text-emerald-200 hover:text-white">×</button>
                      </span>
                    ))}
                  </div>
                  <input 
                    type="text" 
                    placeholder="イベントを検索、または入力して追加..."
                    value={eventInput}
                    onFocus={() => setShowEventList(true)}
                    onChange={(e) => setEventInput(e.target.value)}
                    className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                  {showEventList && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {tags.filter(t => t.type === 'event' && t.name.includes(eventInput)).map(t => (
                        <button key={t.id} onClick={() => toggleSelection(t.id, 'event')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex justify-between items-center">
                          <span>#{t.name}</span>
                          {selectedEventIds.includes(t.id) && <span className="text-green-600 text-xs">✓</span>}
                        </button>
                      ))}
                      {eventInput.trim() && !tags.some(t => t.type === 'event' && t.name === eventInput.trim()) && (
                        <button onClick={() => createNewTag(eventInput, 'event')} className="w-full text-left px-4 py-3 text-sm text-green-600 font-bold bg-green-50 hover:bg-green-100 border-t border-green-100">
                          ✨ "{eventInput}" を新しく追加する
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* コメント */}
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Comment</label>
                  <textarea placeholder="メモを自由に記入..." value={comment} onChange={(e) => setComment(e.target.value)} className="w-full border border-gray-300 p-3 rounded-lg text-sm focus:ring-2 focus:ring-inset focus:ring-gray-800 bg-white flex-1 min-h-[100px]" />
                </div>

              </div>
            </div>
            
            {/* ボタン */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 px-6 sm:px-8 flex-shrink-0">
              <button onClick={closeModal} disabled={isSubmitting} className="px-5 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-bold text-xs">キャンセル</button>
              <button onClick={handleSubmit} disabled={isSubmitting} className="px-8 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition font-bold text-xs">
                {isSubmitting ? "保存中..." : "保存する"}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}