import { useState, useEffect } from 'react';
import {
  ArrowLeft, Printer, Plus, Trash2, Save, History, FileText, Copy,
} from 'lucide-react';
import { db } from './db';

// ========== 設定データ ==========

// 振り返り（個人発表）の項目 ─ 週次振り返りミーティングの発表内容と同じ流れ
const REVIEW_FIELDS = [
  { key: 'did', label: '今月やったこと（具体的な行動）', placeholder: '例：ターゲット居宅への定期訪問、新規デモ3件' },
  { key: 'good', label: '良かったこと（うまくいったこと）', placeholder: '例：○○居宅から新規2件紹介いただけた' },
  { key: 'bad', label: 'うまくいかなかったこと', placeholder: '例：訪問数が目標に届かなかった' },
  { key: 'insight', label: '気づいたこと・学び', placeholder: '例：午前中の訪問の方がケアマネと話せる' },
];

const SHARE_FIELDS = [
  { key: 'trouble', label: '困りごと相談', placeholder: '例：△△の対応で悩んでいる' },
  { key: 'success', label: '成功事例共有', placeholder: '例：□□の提案が喜ばれた' },
  { key: 'improve', label: '改善案・提案', placeholder: '例：チラシを新しくしたい' },
];

const NEXT_FIELDS = [
  { key: 'focus', label: '来月の重点活動', placeholder: '例：ターゲット居宅の訪問頻度を週1に' },
  { key: 'challenge', label: 'チャレンジすること', placeholder: '例：新規居宅2件の開拓' },
  { key: 'help', label: '協力してほしいこと', placeholder: '例：同行訪問をお願いしたい' },
];

// 市川店の営業メンバー（発表順）
const STAFF_OPTIONS = ['中村', '西野', '山口'];

// 実績の固定項目
const RESULT_ITEMS = [
  { key: 'rental', label: 'レンタル', unit: '件' },
  { key: 'goods', label: '用品', unit: '件' },
  { key: 'renovation', label: '住宅改修', unit: '件' },
  { key: 'handrail', label: '手すり', unit: '本' },
  { key: 'survey', label: '現調', unit: '件' },
];

const TARGET_COUNT = 3;

function createEmptyResults() {
  const results = {};
  RESULT_ITEMS.forEach(item => { results[item.key] = { goal: '', actual: '' }; });
  return results;
}

function createEmptyMeeting() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  let staffName = '';
  try { staffName = localStorage.getItem('meetingStaffName') || ''; } catch {}
  return {
    meetingDate: `${yyyy}-${mm}-${dd}`,
    month: `${yyyy}-${mm}`,
    staffName,
    targets: Array.from({ length: TARGET_COUNT }, () => ({ name: '', careManager: '', goalVisits: '', actualVisits: '' })),
    results: createEmptyResults(),
    goals: [
      { item: '', goal: '', result: '' },
      { item: '', goal: '', result: '' },
    ],
    review: { did: '', good: '', bad: '', insight: '' },
    share: { trouble: '', success: '', improve: '' },
    next: { focus: '', challenge: '', help: '' },
    meetingNotes: '',
  };
}

function formatMonth(m) {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return `${y}年${Number(mo)}月`;
}

function formatDateJp(d) {
  if (!d) return '';
  const [y, mo, dd] = d.split('-');
  return `${y}年${Number(mo)}月${Number(dd)}日`;
}

function nextMonthOf(m) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo, 1); // moは1始まりなのでそのまま渡すと翌月になる
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function prevMonthOf(m) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function achievementRate(goal, actual) {
  const g = Number(goal), a = Number(actual);
  if (!g || goal === '' || goal == null || actual === '' || actual == null) return null;
  return Math.round((a / g) * 100);
}

function rateColor(rate) {
  if (rate === null) return 'text-gray-400';
  if (rate >= 100) return 'text-green-600';
  if (rate >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

// 同じ氏名の前月シートを取得（先月実績の自動表示用）
function usePrevMonthRecord(staffName, month) {
  const [prev, setPrev] = useState(null);
  useEffect(() => {
    if (!staffName || !month) { setPrev(null); return; }
    const pm = prevMonthOf(month);
    db.meetings
      .where('staffName').equals(staffName)
      .toArray()
      .then(recs => {
        const hit = recs
          .filter(r => r.month === pm)
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
        setPrev(hit || null);
      })
      .catch(() => setPrev(null));
  }, [staffName, month]);
  return prev;
}

// ========== メイン ==========

export default function App() {
  const [view, setView] = useState('editor');
  const [meeting, setMeeting] = useState(createEmptyMeeting());
  const [currentId, setCurrentId] = useState(null);

  const handleLoad = (record) => {
    const { id, createdAt, updatedAt, ...data } = record;
    const base = createEmptyMeeting();
    setMeeting({
      ...base,
      ...data,
      staffName: data.staffName || base.staffName,
      results: { ...createEmptyResults(), ...(data.results || {}) },
    });
    setCurrentId(id);
    setView('editor');
  };

  const handleNew = () => {
    setMeeting(createEmptyMeeting());
    setCurrentId(null);
    setView('editor');
  };

  // 翌月分を作成：ターゲット居宅と目標の枠は引き継ぎ、実績・振り返りはクリア
  const handleCopyNextMonth = (record) => {
    const base = createEmptyMeeting();
    const carriedResults = createEmptyResults();
    RESULT_ITEMS.forEach(item => {
      carriedResults[item.key] = { goal: record.results?.[item.key]?.goal || '', actual: '' };
    });
    setMeeting({
      ...base,
      month: nextMonthOf(record.month || base.month),
      staffName: record.staffName || base.staffName,
      targets: (record.targets || base.targets).map(t => ({ ...t, actualVisits: '' })),
      results: carriedResults,
      goals: (record.goals || base.goals).map(g => ({ ...g, result: '' })),
    });
    setCurrentId(null);
    setView('editor');
  };

  if (view === 'list') {
    return (
      <MeetingListScreen
        currentId={currentId}
        onLoad={handleLoad}
        onNew={handleNew}
        onCopyNextMonth={handleCopyNextMonth}
        onBack={() => setView('editor')}
      />
    );
  }

  if (view === 'preview') {
    return <MeetingPreviewScreen meeting={meeting} onBack={() => setView('editor')} />;
  }

  return (
    <MeetingEditorScreen
      meeting={meeting}
      setMeeting={setMeeting}
      currentId={currentId}
      onCurrentIdChange={setCurrentId}
      onPreview={() => setView('preview')}
      onList={() => setView('list')}
    />
  );
}

// ========== 編集画面 ==========

function MeetingEditorScreen({ meeting, setMeeting, currentId, onCurrentIdChange, onPreview, onList }) {
  const [saveStatus, setSaveStatus] = useState('saved');
  const prevRecord = usePrevMonthRecord(meeting.staffName, meeting.month);

  const update = (field, value) => setMeeting(prev => ({ ...prev, [field]: value }));
  const updateNested = (group, key, value) =>
    setMeeting(prev => ({ ...prev, [group]: { ...prev[group], [key]: value } }));
  const updateTarget = (idx, key, value) =>
    setMeeting(prev => ({
      ...prev,
      targets: prev.targets.map((t, i) => (i === idx ? { ...t, [key]: value } : t)),
    }));
  const updateResult = (key, field, value) =>
    setMeeting(prev => ({
      ...prev,
      results: { ...prev.results, [key]: { ...prev.results[key], [field]: value } },
    }));
  const updateGoal = (idx, key, value) =>
    setMeeting(prev => ({
      ...prev,
      goals: prev.goals.map((g, i) => (i === idx ? { ...g, [key]: value } : g)),
    }));
  const addGoal = () => setMeeting(prev => ({ ...prev, goals: [...prev.goals, { item: '', goal: '', result: '' }] }));
  const removeGoal = (idx) => setMeeting(prev => ({ ...prev, goals: prev.goals.filter((_, i) => i !== idx) }));

  // 担当者名をlocalStorageに保存
  useEffect(() => {
    try { if (meeting.staffName) localStorage.setItem('meetingStaffName', meeting.staffName); } catch {}
  }, [meeting.staffName]);

  // IndexedDB自動保存（氏名が入力されている場合）
  useEffect(() => {
    if (!meeting.staffName) return;
    setSaveStatus('unsaved');
    const timer = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        const now = Date.now();
        const data = { ...meeting, updatedAt: now };
        if (currentId) {
          data.id = currentId;
          await db.meetings.put(data);
        } else {
          data.createdAt = now;
          const newId = await db.meetings.add(data);
          onCurrentIdChange(newId);
        }
        setSaveStatus('saved');
      } catch (e) {
        console.error('Auto-save failed', e);
        setSaveStatus('unsaved');
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [meeting]);

  const saveIndicator = {
    saved: { label: '自動保存済', color: 'text-green-600' },
    saving: { label: '保存中…', color: 'text-gray-400' },
    unsaved: { label: '未保存', color: 'text-orange-500' },
  }[saveStatus];

  return (
    <div className="min-h-screen bg-gray-100 pb-32">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm sticky top-0 z-10 border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-wide">営業会議シート</h1>
            <p className={`text-xs font-medium ${saveIndicator.color}`}>
              <Save className="w-3 h-3 inline mr-0.5" />
              {saveIndicator.label}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onList}
              className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-1.5 active:bg-gray-200"
            >
              <History className="w-4 h-4" />
              一覧
            </button>
            <button
              onClick={onPreview}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-1.5 active:bg-gray-700"
            >
              <FileText className="w-4 h-4" />
              プレビュー
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-3 py-3 space-y-3">
        {/* 基本情報 */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h2 className="font-bold text-sm text-gray-700">基本情報</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">会議日</label>
              <input
                type="date"
                value={meeting.meetingDate}
                onChange={e => update('meetingDate', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-base"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">対象月</label>
              <input
                type="month"
                value={meeting.month}
                onChange={e => update('month', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-base"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">担当営業（発表者）</label>
            <div className="grid grid-cols-3 gap-2">
              {STAFF_OPTIONS.map(name => (
                <button
                  key={name}
                  onClick={() => update('staffName', name)}
                  className={`py-3 rounded-lg font-bold text-base border-2 active:opacity-70 ${
                    meeting.staffName === name
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">※選択すると自動保存されます</p>
          </div>
        </div>

        {/* 1. ターゲット居宅 */}
        <SectionCard number="1" title="ターゲット居宅（3件）" subtitle="今月の重点訪問先と訪問数">
          <div className="space-y-3">
            {meeting.targets.map((t, i) => {
              const rate = achievementRate(t.goalVisits, t.actualVisits);
              return (
                <div key={i} className="border rounded-lg p-3 bg-gray-50 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-gray-900 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">{i + 1}</span>
                    <input
                      type="text"
                      value={t.name}
                      onChange={e => updateTarget(i, 'name', e.target.value)}
                      placeholder="居宅介護支援事業所名"
                      className="flex-1 border rounded-lg px-3 py-2 text-base bg-white"
                    />
                  </div>
                  <div className="pl-8">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">担当ケアマネ</label>
                    <input
                      type="text"
                      value={t.careManager || ''}
                      onChange={e => updateTarget(i, 'careManager', e.target.value)}
                      placeholder="例：佐藤 花子"
                      className="w-full border rounded-lg px-3 py-2 text-base bg-white"
                    />
                  </div>
                  <div className="flex items-center gap-2 pl-8">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">目標訪問数</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={t.goalVisits}
                        onChange={e => updateTarget(i, 'goalVisits', e.target.value)}
                        placeholder="0"
                        className="w-full border rounded-lg px-3 py-2 text-base bg-white text-center"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">実際の訪問数</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={t.actualVisits}
                        onChange={e => updateTarget(i, 'actualVisits', e.target.value)}
                        placeholder="0"
                        className="w-full border rounded-lg px-3 py-2 text-base bg-white text-center"
                      />
                    </div>
                    <div className="w-20 text-center">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">達成率</label>
                      <p className={`text-lg font-bold py-1.5 ${rateColor(rate)}`}>
                        {rate === null ? '─' : `${rate}%`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* 2. 実績 */}
        <SectionCard number="2" title="実績" subtitle="レンタル・用品・住宅改修・手すり・現調">
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_70px_70px_70px_60px] gap-2 text-xs font-semibold text-gray-600 px-1">
              <span>項目</span>
              <span className="text-center">先月実績</span>
              <span className="text-center">目標</span>
              <span className="text-center">実績</span>
              <span className="text-center">達成率</span>
            </div>
            {RESULT_ITEMS.map(item => {
              const r = meeting.results[item.key] || { goal: '', actual: '' };
              const rate = achievementRate(r.goal, r.actual);
              const prevActual = prevRecord?.results?.[item.key]?.actual;
              return (
                <div key={item.key} className="grid grid-cols-[1fr_70px_70px_70px_60px] gap-2 items-center">
                  <span className="font-bold text-sm text-gray-800 pl-1">
                    {item.label}
                    <span className="text-xs text-gray-400 font-normal ml-1">({item.unit})</span>
                  </span>
                  <span className="text-center text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg py-2">
                    {prevActual !== undefined && prevActual !== '' ? prevActual : '─'}
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={r.goal}
                    onChange={e => updateResult(item.key, 'goal', e.target.value)}
                    placeholder="0"
                    className="border rounded-lg px-2 py-2 text-base text-center"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    value={r.actual}
                    onChange={e => updateResult(item.key, 'actual', e.target.value)}
                    placeholder="0"
                    className="border rounded-lg px-2 py-2 text-base text-center"
                  />
                  <span className={`text-center text-sm font-bold ${rateColor(rate)}`}>
                    {rate === null ? '─' : `${rate}%`}
                  </span>
                </div>
              );
            })}
            <p className="text-xs text-gray-400 pt-1">
              ※先月実績は、同じ氏名で保存された前月のシートから自動表示されます
            </p>
          </div>
        </SectionCard>

        {/* 3. その他の目標と結果 */}
        <SectionCard number="3" title="その他の目標と結果" subtitle="上記以外の目標があれば自由に追加">
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_80px_80px_36px] gap-2 text-xs font-semibold text-gray-600 px-1">
              <span>項目</span>
              <span className="text-center">目標</span>
              <span className="text-center">結果</span>
              <span />
            </div>
            {meeting.goals.map((g, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_80px_36px] gap-2 items-center">
                <input
                  type="text"
                  value={g.item}
                  onChange={e => updateGoal(i, 'item', e.target.value)}
                  placeholder={i === 0 ? '例：売上' : '項目名'}
                  className="border rounded-lg px-3 py-2 text-base"
                />
                <input
                  type="text"
                  value={g.goal}
                  onChange={e => updateGoal(i, 'goal', e.target.value)}
                  placeholder="目標"
                  className="border rounded-lg px-2 py-2 text-base text-center"
                />
                <input
                  type="text"
                  value={g.result}
                  onChange={e => updateGoal(i, 'result', e.target.value)}
                  placeholder="結果"
                  className="border rounded-lg px-2 py-2 text-base text-center"
                />
                <button
                  onClick={() => removeGoal(i)}
                  className="text-gray-400 active:text-red-500 p-2"
                  aria-label="行を削除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={addGoal}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg py-2 text-sm font-bold text-gray-500 flex items-center justify-center gap-1 active:bg-gray-50"
            >
              <Plus className="w-4 h-4" />
              行を追加
            </button>
          </div>
        </SectionCard>

        {/* 4. 今月の振り返り */}
        <SectionCard number="4" title="今月の振り返り（個人発表）" subtitle="1人3分・本音の共有を大切に" accent="border-orange-400">
          {REVIEW_FIELDS.map(f => (
            <TextField key={f.key} label={f.label} placeholder={f.placeholder}
              value={meeting.review[f.key]} onChange={v => updateNested('review', f.key, v)} rows={3} />
          ))}
        </SectionCard>

        {/* 5. 全体共有 */}
        <SectionCard number="5" title="全体共有" subtitle="誰かを責めるのではなく、みんなで考える" accent="border-green-500">
          {SHARE_FIELDS.map(f => (
            <TextField key={f.key} label={f.label} placeholder={f.placeholder}
              value={meeting.share[f.key]} onChange={v => updateNested('share', f.key, v)} rows={3} />
          ))}
        </SectionCard>

        {/* 6. 来月の行動 */}
        <SectionCard number="6" title="来月の行動" subtitle="やることを明確にして来月へつなげる" accent="border-blue-500">
          {NEXT_FIELDS.map(f => (
            <TextField key={f.key} label={f.label} placeholder={f.placeholder}
              value={meeting.next[f.key]} onChange={v => updateNested('next', f.key, v)} rows={3} />
          ))}
        </SectionCard>

        {/* 7. 会議メモ */}
        <SectionCard number="7" title="会議メモ（当日記入）" subtitle="部長・SVからのコメント、決定事項など">
          <textarea
            value={meeting.meetingNotes}
            onChange={e => update('meetingNotes', e.target.value)}
            placeholder="会議当日に記入します"
            rows={4}
            className="w-full border rounded-lg px-3 py-2 text-base"
          />
        </SectionCard>
      </div>

      {/* 下部固定バー */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t shadow-lg p-3 z-10">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={onPreview}
            className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 active:bg-gray-700"
          >
            <FileText className="w-5 h-5" />
            A3プレビューを見る
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ number, title, subtitle, accent = 'border-gray-300', children }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm p-4 space-y-3 border-l-4 ${accent}`}>
      <div className="flex items-center gap-2">
        <span className="bg-gray-900 text-white text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center shrink-0">{number}</span>
        <div>
          <h2 className="font-bold text-sm text-gray-800">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, rows = 2 }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full border rounded-lg px-3 py-2 text-base"
      />
    </div>
  );
}

// ========== 一覧画面 ==========

function MeetingListScreen({ currentId, onLoad, onNew, onCopyNextMonth, onBack }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const all = await db.meetings.toArray();
      all.sort((a, b) => (b.month || '').localeCompare(a.month || '') || (b.updatedAt || 0) - (a.updatedAt || 0));
      setRecords(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRecords(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('このシートを削除しますか？')) return;
    await db.meetings.delete(id);
    loadRecords();
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-8">
      <div className="bg-white shadow-sm sticky top-0 z-10 border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-1 active:opacity-60">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-bold">戻る</span>
          </button>
          <h1 className="text-lg font-bold">会議シート一覧</h1>
          <button
            onClick={onNew}
            className="bg-gray-900 text-white px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            新規
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-3 py-3 space-y-2">
        {loading ? (
          <p className="text-center text-gray-400 py-10 text-sm">読み込み中…</p>
        ) : records.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">保存されたシートはありません</p>
        ) : (
          records.map(r => (
            <div
              key={r.id}
              className={`bg-white rounded-xl shadow-sm p-4 ${r.id === currentId ? 'ring-2 ring-gray-900' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-base truncate">
                    {formatMonth(r.month)}　{r.staffName || '（氏名未入力）'}
                  </p>
                  <p className="text-xs text-gray-400">
                    会議日：{formatDateJp(r.meetingDate) || '未設定'}
                    {r.id === currentId && <span className="ml-2 text-gray-900 font-bold">編集中</span>}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => onLoad(r)}
                    className="bg-gray-900 text-white px-3 py-2 rounded-lg font-bold text-xs"
                  >
                    開く
                  </button>
                  <button
                    onClick={() => onCopyNextMonth(r)}
                    className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-1"
                    title="ターゲット居宅と目標を引き継いで翌月分を作成"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    翌月分
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="bg-red-50 text-red-600 px-3 py-2 rounded-lg font-bold text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ========== A3横プレビュー画面 ==========

function MeetingPreviewScreen({ meeting, onBack }) {
  const handlePrint = () => window.print();
  const prevRecord = usePrevMonthRecord(meeting.staffName, meeting.month);

  return (
    <div className="bg-gray-300 min-h-screen">
      <style>{`
        @media print {
          @page { size: A3 landscape; margin: 0; }
          body { background: white; }
          .no-print { display: none !important; }
          .print-sheet { box-shadow: none !important; margin: 0 !important; width: 420mm !important; min-height: 297mm !important; }
        }
      `}</style>

      {/* 操作バー */}
      <div className="no-print sticky top-0 bg-gray-900 text-white px-4 py-3 flex items-center justify-between z-10 shadow-md">
        <button onClick={onBack} className="flex items-center gap-1 active:opacity-60">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-bold">編集に戻る</span>
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-300">A3横で印刷してください</span>
          <button
            onClick={handlePrint}
            className="bg-white text-gray-900 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            印刷
          </button>
        </div>
      </div>

      {/* A3横シート */}
      <div
        className="print-sheet bg-white mx-auto my-4 shadow-xl"
        style={{ width: '420mm', minHeight: '297mm', padding: '9mm 11mm', fontSize: '10pt', color: '#111' }}
      >
        {/* ヘッダー */}
        <div className="flex items-end justify-between border-b-2 border-gray-900 pb-1.5">
          <div className="flex items-end gap-6">
            <h1 style={{ fontSize: '17pt' }} className="font-bold tracking-wide">月次営業会議シート</h1>
            <div className="flex items-center gap-2 pb-0.5">
              <span className="bg-gray-800 text-white font-bold px-2.5 py-0.5" style={{ fontSize: '9pt' }}>発表者</span>
              <span className="font-bold" style={{ fontSize: '13pt' }}>{meeting.staffName || '　　　　　'}</span>
            </div>
          </div>
          <div className="text-right" style={{ fontSize: '10pt' }}>
            <span className="font-bold mr-5">対象月：{formatMonth(meeting.month) || '─'}</span>
            <span className="font-bold">会議日：{formatDateJp(meeting.meetingDate) || '─'}</span>
          </div>
        </div>

        {/* 3カラム */}
        <div className="grid mt-2" style={{ gridTemplateColumns: '116mm 1fr 1fr', gap: '5mm' }}>
          {/* 左：数値（ターゲット居宅・実績・その他目標） */}
          <div>
            <PrintSectionTitle number="1" title="ターゲット居宅（重点訪問先）" />
            <table className="w-full border-collapse" style={{ fontSize: '9pt' }}>
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-1 py-1 w-6"></th>
                  <th className="border border-gray-400 px-1.5 py-1 text-left">居宅介護支援事業所名 / 担当ケアマネ</th>
                  <th className="border border-gray-400 px-1 py-1 w-14">目標<br />訪問数</th>
                  <th className="border border-gray-400 px-1 py-1 w-14">実際の<br />訪問数</th>
                  <th className="border border-gray-400 px-1 py-1 w-14">達成率</th>
                </tr>
              </thead>
              <tbody>
                {meeting.targets.map((t, i) => {
                  const rate = achievementRate(t.goalVisits, t.actualVisits);
                  return (
                    <tr key={i}>
                      <td className="border border-gray-400 px-1 py-2 text-center font-bold">{i + 1}</td>
                      <td className="border border-gray-400 px-1.5 py-2">
                        <div>{t.name}</div>
                        {t.careManager && (
                          <div className="text-gray-600" style={{ fontSize: '8pt' }}>CM：{t.careManager}</div>
                        )}
                      </td>
                      <td className="border border-gray-400 px-1 py-2 text-center">{t.goalVisits !== '' ? t.goalVisits : ''}</td>
                      <td className="border border-gray-400 px-1 py-2 text-center">{t.actualVisits !== '' ? t.actualVisits : ''}</td>
                      <td className={`border border-gray-400 px-1 py-2 text-center font-bold ${rateColor(rate)}`}>
                        {rate === null ? '' : `${rate}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <PrintSectionTitle number="2" title="実績" />
            <table className="w-full border-collapse" style={{ fontSize: '9pt' }}>
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-1.5 py-1 text-left">項目</th>
                  <th className="border border-gray-400 px-1 py-1 w-16">先月実績</th>
                  <th className="border border-gray-400 px-1 py-1 w-14">目標</th>
                  <th className="border border-gray-400 px-1 py-1 w-14">実績</th>
                  <th className="border border-gray-400 px-1 py-1 w-14">達成率</th>
                </tr>
              </thead>
              <tbody>
                {RESULT_ITEMS.map(item => {
                  const r = meeting.results[item.key] || { goal: '', actual: '' };
                  const rate = achievementRate(r.goal, r.actual);
                  const prevActual = prevRecord?.results?.[item.key]?.actual;
                  return (
                    <tr key={item.key}>
                      <td className="border border-gray-400 px-1.5 py-1.5 font-bold">
                        {item.label}<span className="font-normal text-gray-500">（{item.unit}）</span>
                      </td>
                      <td className="border border-gray-400 px-1 py-1.5 text-center text-gray-600">
                        {prevActual !== undefined && prevActual !== '' ? prevActual : ''}
                      </td>
                      <td className="border border-gray-400 px-1 py-1.5 text-center">{r.goal !== '' ? r.goal : ''}</td>
                      <td className="border border-gray-400 px-1 py-1.5 text-center font-bold">{r.actual !== '' ? r.actual : ''}</td>
                      <td className={`border border-gray-400 px-1 py-1.5 text-center font-bold ${rateColor(rate)}`}>
                        {rate === null ? '' : `${rate}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {meeting.goals.some(g => g.item || g.goal || g.result) && (
              <>
                <PrintSectionTitle number="3" title="その他の目標と結果" />
                <table className="w-full border-collapse" style={{ fontSize: '9pt' }}>
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-400 px-1.5 py-1 text-left">項目</th>
                      <th className="border border-gray-400 px-1 py-1 w-20">目標</th>
                      <th className="border border-gray-400 px-1 py-1 w-20">結果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meeting.goals.filter(g => g.item || g.goal || g.result).map((g, i) => (
                      <tr key={i}>
                        <td className="border border-gray-400 px-1.5 py-1.5">{g.item}</td>
                        <td className="border border-gray-400 px-1 py-1.5 text-center">{g.goal}</td>
                        <td className="border border-gray-400 px-1 py-1.5 text-center">{g.result}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

          {/* 中央：今月の振り返り（大きめの記入欄） */}
          <div>
            <PrintSectionTitle number="4" title="今月の振り返り（個人発表）" />
            <div className="space-y-2">
              {REVIEW_FIELDS.map(f => (
                <PrintBox key={f.key} label={f.label} value={meeting.review[f.key]} minHeight="42mm" />
              ))}
            </div>
          </div>

          {/* 右：全体共有＋来月の行動 */}
          <div>
            <PrintSectionTitle number="5" title="全体共有（相談・成功事例・改善案）" />
            <div className="space-y-2">
              {SHARE_FIELDS.map(f => (
                <PrintBox key={f.key} label={f.label} value={meeting.share[f.key]} minHeight="30mm" />
              ))}
            </div>

            <PrintSectionTitle number="6" title="来月の行動" />
            <div className="space-y-2">
              {NEXT_FIELDS.map(f => (
                <PrintBox key={f.key} label={f.label} value={meeting.next[f.key]} minHeight="22mm" green />
              ))}
            </div>
          </div>
        </div>

        {/* 会議メモ（全幅） */}
        <PrintSectionTitle number="7" title="会議メモ（当日記入：部長・SVコメント、決定事項）" />
        <div
          className="border border-gray-400 rounded px-2 py-1.5"
          style={{ minHeight: '32mm', fontSize: '10pt', whiteSpace: 'pre-wrap' }}
        >
          {meeting.meetingNotes}
        </div>

        {/* フッター */}
        <div className="mt-2 pt-1.5 border-t border-gray-300 text-center text-gray-500" style={{ fontSize: '8pt' }}>
          振り返りは「過去を責める時間」ではなく「未来を良くする時間」
        </div>
      </div>
    </div>
  );
}

function PrintSectionTitle({ number, title }) {
  return (
    <div className="flex items-center gap-1.5 mt-2.5 mb-1">
      <span
        className="bg-gray-900 text-white font-bold rounded-full flex items-center justify-center shrink-0"
        style={{ width: '6mm', height: '6mm', fontSize: '9.5pt' }}
      >
        {number}
      </span>
      <h2 className="font-bold" style={{ fontSize: '11.5pt' }}>{title}</h2>
    </div>
  );
}

function PrintBox({ label, value, minHeight, green }) {
  return (
    <div className={`border rounded overflow-hidden ${green ? 'border-green-600' : 'border-gray-400'}`}>
      <p
        className={`px-2 py-0.5 font-bold ${green ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-700'}`}
        style={{ fontSize: '8.5pt' }}
      >
        {label}
      </p>
      <p className="px-2 py-1" style={{ minHeight, fontSize: '10pt', whiteSpace: 'pre-wrap' }}>{value}</p>
    </div>
  );
}
