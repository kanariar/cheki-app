"use client";

import { useState } from 'react';
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

  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [addedPeopleNames, setAddedPeopleNames] = useState<string[]>([]);
  const [addedEventNames, setAddedEventNames] = useState<string[]>([]);

  const [isCreatingPeople, setIsCreatingPeople] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [newPeopleName, setNewPeopleName] = useState("");
  const [newEventName, setNewEventName] = useState("");

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

  const handleSelectPeople = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (id && !selectedPeopleIds.map(i => String(i)).includes(String(id))) {
      setSelectedPeopleIds([...selectedPeopleIds, id]);
    }
    e.target.value = "";
  };

  const handleSelectEvent = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (id && !selectedEventIds.map(i => String(i)).includes(String(id))) {
      setSelectedEventIds([...selectedEventIds, id]);
    }
    e.target.value = "";
  };

  const handleAddPeopleName = () => {
    const trimmed = newPeopleName.trim();
    if (trimmed && !addedPeopleNames.includes(trimmed)) {
      if (tags.some(t => t.name === trimmed)) {
        alert("そのタグは既に存在します。プルダウンから選択してください。");
        return;
      }
      setAddedPeopleNames([...addedPeopleNames, trimmed]);
      setNewPeopleName("");
    }
  };

  const handleAddEventName = () => {
    const trimmed = newEventName.trim();
    if (trimmed && !addedEventNames.includes(trimmed)) {
      if (tags.some(t => t.name === trimmed)) {
        alert("そのタグは既に存在します。プルダウンから選択してください。");
        return;
      }
      setAddedEventNames([...addedEventNames, trimmed]);
      setNewEventName("");
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
    setIsCreatingPeople(false);
    setIsCreatingEvent(false);
    setNewPeopleName("");
    setNewEventName("");
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
      if (userError || !user) throw new Error("ユーザー認証情報の取得に失敗しました。再度ログインしてください。");

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
        
        const currentPeopleNames = [...addedPeopleNames];
        if (newPeopleName.trim() && !currentPeopleNames.includes(newPeopleName.trim()) && !tags.some(t => t.name === newPeopleName.trim())) {
          currentPeopleNames.push(newPeopleName.trim());
        }
        for (const name of currentPeopleNames) {
          const { data: tagData, error: tagError } = await supabase.from('tags').upsert({ name: name, type: 'people' }, { onConflict: 'name' }).select().single();
          if (tagError) throw tagError;
          if (tagData) finalTagIds.push(tagData.id);
        }

        const currentEventNames = [...addedEventNames];
        if (newEventName.trim() && !currentEventNames.includes(newEventName.trim()) && !tags.some(t => t.name === newEventName.trim())) {
          currentEventNames.push(newEventName.trim());
        }
        for (const name of currentEventNames) {
          const { data: tagData, error: tagError } = await supabase.from('tags').upsert({ name: name, type: 'event' }, { onConflict: 'name' }).select().single();
          if (tagError) throw tagError;
          if (tagData) finalTagIds.push(tagData.id);
        }

        for (const tagId of finalTagIds) {
          const { error: ptError } = await supabase.from('post_tags').insert({ post_id: newPost.id, tag_id: tagId });
          if (ptError) throw ptError; 
        }
      }
      closeModal();
      onSuccess(); 
    } catch (error: any) {
      console.error("保存エラーの詳細:", error);
      alert(`保存に失敗しました。詳細: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* ★ 改修：ボタンテキストを「＋ 新規」に */}
      <button onClick={() => setIsOpen(true)} className="bg-gray-800 text-white px-4 py-2 rounded-full shadow-md hover:bg-gray-700 transition font-bold text-sm">
        ＋ 新規
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-2 sm:p-4">
          
          {/* ★ 改修：白枠の内側の余白(p-8)を消し、ヘッダーとフッターにだけ余白を付けることでスクロールバーを右端に密着させる */}
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col py-4 sm:py-6">
            
            <h2 className="text-xl sm:text-2xl font-bold mb-4 px-4 sm:px-8 text-gray-900 flex-shrink-0">新しい思い出を登録</h2>
            
            {/* スクロール領域。中身に px-4 sm:px-8 を付けて余白を確保し、バー自体は枠の右端に出るようにした */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 overflow-y-auto px-4 sm:px-8 pb-2">
              
              <div className="md:col-span-5 flex flex-col gap-4">
                <div className="aspect-[3/4] w-full max-w-[240px] mx-auto bg-gray-100 flex items-center justify-center overflow-hidden rounded border border-gray-200 shadow-inner flex-shrink-0">
                  {previewUrl ? <img src={previewUrl} alt="プレビュー" className="w-full h-full object-cover" /> : <span className="text-gray-400 text-sm">画像を選択してください</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">写真を選択</label>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="text-sm text-gray-900 file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-gray-100 file:text-gray-700 flex-shrink-0 cursor-pointer" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between">
                    思い出の日付
                    <span className="text-gray-400 font-normal">写真から自動取得・修正可</span>
                  </label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-gray-300 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-800 text-sm bg-white text-gray-900 font-medium" />
                </div>
              </div>

              <div className="md:col-span-7 flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1"><span>👤</span> 人物タグ (Who)</label>
                  <div className="flex gap-2 items-center">
                    <select onChange={handleSelectPeople} className="flex-1 border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-blue-500 text-sm bg-white text-gray-900 font-medium">
                      <option value="">-- 既存の人物から選択 --</option>
                      {tags.filter(t => t.type === 'people').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button type="button" onClick={() => setIsCreatingPeople(!isCreatingPeople)} className="bg-gray-100 border border-gray-300 p-2 rounded-md text-sm font-bold px-3">{isCreatingPeople ? "×" : "＋"}</button>
                  </div>
                  {isCreatingPeople && (
                    <div className="flex gap-2 bg-blue-50/50 p-2 rounded border border-blue-100 flex-shrink-0">
                      <input type="text" placeholder="新しい人の名前 (Enterで追加)" value={newPeopleName} onChange={(e) => setNewPeopleName(e.target.value)} onKeyDown={(e) => { if(!e.nativeEvent.isComposing && e.key === 'Enter') { e.preventDefault(); handleAddPeopleName(); } }} className="flex-1 border border-gray-300 p-1.5 text-sm rounded bg-white text-gray-900 placeholder-gray-400" />
                      <button type="button" onClick={handleAddPeopleName} className="bg-blue-600 text-white text-xs px-3 rounded font-bold">追加</button>
                    </div>
                  )}
                  {(selectedPeopleIds.length > 0 || addedPeopleNames.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-blue-50/20 rounded border border-blue-50 flex-shrink-0">
                      {selectedPeopleIds.map(id => { const t = tags.find(tag => String(tag.id) === String(id)); return t ? <span key={String(id)} className="inline-flex items-center bg-blue-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">#{t.name}<button type="button" onClick={() => setSelectedPeopleIds(selectedPeopleIds.filter(i => i !== id))} className="ml-1 font-bold">×</button></span> : null; })}
                      {addedPeopleNames.map(name => <span key={name} className="inline-flex items-center bg-cyan-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">#{name} (新)<button type="button" onClick={() => setAddedPeopleNames(addedPeopleNames.filter(n => n !== name))} className="ml-1 font-bold">×</button></span>)}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-green-600 uppercase tracking-wider flex items-center gap-1"><span>🏷️</span> イベントタグ (What / Where)</label>
                  <div className="flex gap-2 items-center">
                    <select onChange={handleSelectEvent} className="flex-1 border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-green-500 text-sm bg-white text-gray-900 font-medium">
                      <option value="">-- 既存のイベントから選択 --</option>
                      {tags.filter(t => t.type === 'event').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button type="button" onClick={() => setIsCreatingEvent(!isCreatingEvent)} className="bg-gray-100 border border-gray-300 p-2 rounded-md text-sm font-bold px-3">{isCreatingEvent ? "×" : "＋"}</button>
                  </div>
                  {isCreatingEvent && (
                    <div className="flex gap-2 bg-green-50/50 p-2 rounded border border-green-100 flex-shrink-0">
                      <input type="text" placeholder="新しいイベント名 (Enterで追加)" value={newEventName} onChange={(e) => setNewEventName(e.target.value)} onKeyDown={(e) => { if(!e.nativeEvent.isComposing && e.key === 'Enter') { e.preventDefault(); handleAddEventName(); } }} className="flex-1 border border-gray-300 p-1.5 text-sm rounded bg-white text-gray-900 placeholder-gray-400" />
                      <button type="button" onClick={handleAddEventName} className="bg-green-600 text-white text-xs px-3 rounded font-bold">追加</button>
                    </div>
                  )}
                  {(selectedEventIds.length > 0 || addedEventNames.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-green-50/20 rounded border border-green-50 flex-shrink-0">
                      {selectedEventIds.map(id => { const t = tags.find(tag => String(tag.id) === String(id)); return t ? <span key={String(id)} className="inline-flex items-center bg-green-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">#{t.name}<button type="button" onClick={() => setSelectedEventIds(selectedEventIds.filter(i => i !== id))} className="ml-1 font-bold">×</button></span> : null; })}
                      {addedEventNames.map(name => <span key={name} className="inline-flex items-center bg-emerald-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">#{name} (新)<button type="button" onClick={() => setAddedEventNames(addedEventNames.filter(n => n !== name))} className="ml-1 font-bold">×</button></span>)}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">コメント</label>
                  <textarea placeholder="その日の出来事やプレゼントのメモを自由に記入..." value={comment} onChange={(e) => setComment(e.target.value)} className="w-full max-w-full border border-gray-300 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-800 text-gray-900 placeholder-gray-400 bg-white font-medium flex-1 min-h-[120px]" />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 flex-shrink-0 px-4 sm:px-8">
              <button onClick={closeModal} disabled={isSubmitting} className="px-5 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition font-bold text-sm">キャンセル</button>
              <button onClick={handleSubmit} disabled={isSubmitting} className="px-7 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition flex items-center font-bold text-sm">
                {isSubmitting ? "保存中..." : "保存する"}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}