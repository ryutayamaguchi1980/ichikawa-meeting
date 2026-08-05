import { useState, useEffect, Fragment } from 'react';
import {
  ArrowLeft, Printer, Plus, Trash2, Save, History, FileText, Copy,
} from 'lucide-react';
import { db } from './db';

// ========== 設定データ ==========

// 今月の事実（何をしたか）
const DID_FIELD = {
  key: 'did',
  label: '今月やったこと（事実）',
  placeholder: '例：ターゲット居宅3件へ毎週訪問。新規デモ5件。ケアマネ勉強会に1回参加。',
};

// 「何が起きたか」→「なぜそうなったか」をセットで振り返る
const REVIEW_PAIRS = [
  {
    key: 'good',
    title: 'うまくいったこと',
    tone: 'good',
    what: {
      key: 'goodWhat',
      label: '何がうまくいった？',
      placeholder: '例：ケアプランセンターAから新規2件のご紹介をいただけた',
    },
    why: {
      key: 'goodWhy',
      label: 'なぜうまくいった？（自分は何をした？）',
      placeholder: '例：毎週同じ曜日の午前に顔を出し続けたことで、困ったときに真っ先に思い出してもらえたから',
    },
  },
  {
    key: 'bad',
    title: 'うまくいかなかったこと',
    tone: 'bad',
    what: {
      key: 'badWhat',
      label: '何がうまくいかなかった？',
      placeholder: '例：目標8件に対して訪問が6件にとどまった',
    },
    why: {
      key: 'badWhy',
      label: 'なぜそうなった？（自分に変えられた点は？）',
      placeholder: '例：訪問を午後に入れていたため、急な納品対応が入るたびに後回しになった',
    },
  },
];

// 振り返りから導く「次も使える自分なりの法則」
const LEARNING_FIELD = {
  key: 'learning',
  label: '今月の学び ─ 次も使える自分なりの法則',
  placeholder: '例：ケアマネとの関係づくりは「回数 × 同じ曜日」が効く。訪問は午前に固定した方が崩れない。',
};

const SHARE_FIELDS = [
  { key: 'trouble', label: '困りごと・相談したいこと', placeholder: '例：△△さんへの提案が通らず悩んでいる' },
  { key: 'success', label: 'みんなに使ってほしい成功事例', placeholder: '例：□□の提案時にカタログではなく実物を持参したら即決だった' },
  { key: 'improve', label: '市川店をこう変えたい（改善案）', placeholder: '例：デモ機の予約表を作りたい' },
];

const NEXT_FIELDS = [
  {
    key: 'focus',
    label: '来月やること（必ずやる）',
    hint: 'いつ・どこで・何をするかまで決める',
    placeholder: '例：ターゲット居宅3件へ、毎週火曜の午前に訪問する',
  },
  {
    key: 'challenge',
    label: '来月のチャレンジ（初めて試すこと）',
    hint: 'うまくいかなくてもOK。結果より「やってみて何が分かったか」',
    placeholder: '例：初回訪問でその場で簡単な図面を書いて渡してみる',
  },
  {
    key: 'help',
    label: '気がかりな案件・止まっていること',
    hint: '見積りが出せていない／工事日が決まらない／溜まっている／なんとなく不安。小さいうちに出すのが一番ラク',
    placeholder: '例：△△様の見積りが3週間止まっている／□□様の工事日が来月以降しか取れそうにない／○○様、ご家族の意見が割れていて心配',
  },
];

// 市川店の営業メンバー（発表順）
const STAFF_OPTIONS = ['奈菜', '西野', '山口'];

// 金額で追う項目（50期の売上表と同じ3本立て・税抜）
// レンタルは総額ではなく「新規額」を追う（会社の営業別シートに合わせる）
const MONEY_ITEMS = [
  { key: 'goodsYen', label: '用品' },
  { key: 'rentalYen', label: 'レンタル新規額' },
  { key: 'renovationYen', label: '住宅改修' },
];

// 件数で追う項目。focus:true は会社の内訳表で★が付いている重点項目
const COUNT_ITEMS = [
  { key: 'newContracts', label: '新規契約者数', short: '新規契約', unit: '件', focus: true },
  { key: 'handrailRental', label: '手すり（レンタル）', short: '手すりﾚﾝﾀﾙ', unit: '本', focus: true },
  { key: 'rentalCareMgr', label: 'レンタル受注ケアマネ数', short: 'ﾚﾝﾀﾙ受注CM', unit: '人', focus: true },
  { key: 'homeVisits', label: '居宅訪問数', short: '居宅訪問', unit: '件', focus: true },
  { key: 'surveyNormal', label: '現調（通常）', short: '現調(通常)', unit: '件' },
  { key: 'surveySales', label: '現調（営業）', short: '現調(営業)', unit: '件' },
  { key: 'surveyOrderHome', label: '現調受注居宅数', short: '現調受注居宅', unit: '件' },
  { key: 'completed', label: '完工件数', short: '完工', unit: '件' },
  { key: 'over1m', label: '100超 完工', short: '100超完工', unit: '件', focus: true },
];

// 補聴器は「測定 → 販売」の流れで追うため、実績表とは別枠で扱う
const HEARING_ITEMS = [
  { key: 'hearingMeasure', label: '測定数', unit: '件' },
  { key: 'hearingSale', label: '販売数', unit: '台', focus: true },
];
const ALL_RESULT_KEYS = [...MONEY_ITEMS, ...COUNT_ITEMS, ...HEARING_ITEMS];

// 50期の月次目標（税抜・円）。期中は毎月同じなので、担当営業を選ぶと自動で入る
const PERIOD_LABEL = '50期';
const MONTHLY_GOALS = {
  山口: { goodsYen: 300000, rentalYen: 120000, renovationYen: 500000 },
  奈菜: { goodsYen: 300000, rentalYen: 120000, renovationYen: 500000 },
  西野: { goodsYen: 300000, rentalYen: 120000, renovationYen: 500000 },
};
// 店としての目標。個人目標の合計より大きいので、差額が分かるように別で持つ
const STORE_GOALS = { goodsYen: 1000000, rentalYen: 400000, renovationYen: 1750000 };

function yen(v) {
  const n = Number(v);
  if (v === '' || v == null || !Number.isFinite(n)) return '';
  return n.toLocaleString('ja-JP');
}

// 目標に対する残り（マイナス＝未達）
function remaining(goal, actual) {
  const g = Number(goal), a = Number(actual);
  if (goal === '' || goal == null || actual === '' || actual == null) return null;
  if (!Number.isFinite(g) || !Number.isFinite(a)) return null;
  return a - g;
}

// アクション数（日々の営業活動のカウント）
const ACTION_DAYS = ['月', '火', '水', '木', '金', '土'];
const ACTION_WEEKS = 5;
const ACTION_DAY_GOAL = 10;   // 1日あたりの目標
const ACTION_WEEK_GOAL = 50;  // 1週あたりの目標

// ケアマネ・ご家族から聞いた声
const VOICE_FIELD = {
  key: 'voices',
  label: 'ケアマネ・ご家族からの情報・ご意見',
  hint: '現場で聞いた生の声。市川店の次の一手のヒントになります',
  placeholder: '例：○○ケアマネ「退院前カンファに同席してほしい」／△△様のご家族「夜間のトイレが不安」',
};

const TARGET_COUNT = 3;

function createEmptyResults() {
  const results = {};
  ALL_RESULT_KEYS.forEach(item => { results[item.key] = { goal: '', actual: '' }; });
  return results;
}

// 旧形式の記録を読み替える（現調が1種類だった頃／レンタル等が件数だった頃）
function migrateResults(results) {
  const merged = { ...createEmptyResults(), ...(results || {}) };
  if (results?.survey && !results?.surveyNormal) {
    merged.surveyNormal = results.survey;
  }
  if (results?.handrail && !results?.handrailRental) {
    merged.handrailRental = results.handrail;
  }
  if (results?.surveyOrder && !results?.surveyOrderHome) {
    merged.surveyOrderHome = results.surveyOrder;
  }
  if (results?.rentalNew && !results?.newContracts) {
    merged.newContracts = results.rentalNew;
  }
  return merged;
}

// 担当営業の50期目標を、まだ空欄の項目にだけ入れる（入力済みの値は上書きしない）
function applyPeriodGoals(results, staffName, { force = false } = {}) {
  const goals = MONTHLY_GOALS[staffName];
  if (!goals) return results;
  const next = { ...results };
  MONEY_ITEMS.forEach(item => {
    const cur = next[item.key] || { goal: '', actual: '' };
    if (force || cur.goal === '' || cur.goal == null) {
      next[item.key] = { ...cur, goal: String(goals[item.key]) };
    }
  });
  return next;
}

function createEmptyActions() {
  return Array.from({ length: ACTION_WEEKS }, () => Array(ACTION_DAYS.length).fill(''));
}

// 空欄は0として扱う。1つも入力が無い場合は null を返して「─」表示にする
function sumCells(cells) {
  const nums = cells.filter(v => v !== '' && v != null).map(Number).filter(Number.isFinite);
  return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
}

function actionWeekTotal(weeks, wi) {
  return sumCells(weeks[wi] || []);
}

function actionDayTotal(weeks, di) {
  return sumCells(weeks.map(w => w[di]));
}

function actionGrandTotal(weeks) {
  return sumCells(weeks.flat());
}

// 補聴器の成約率（測定数のうち何件が販売になったか）
function hearingConversion(results) {
  const m = Number(results?.hearingMeasure?.actual);
  const s = Number(results?.hearingSale?.actual);
  if (!m || !Number.isFinite(m) || !Number.isFinite(s)) return null;
  return Math.round((s / m) * 100);
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
    actions: createEmptyActions(),
    voices: '',
    review: { did: '', goodWhat: '', goodWhy: '', badWhat: '', badWhy: '', learning: '' },
    share: { trouble: '', success: '', improve: '' },
    next: { focus: '', challenge: '', help: '' },
  };
}

// 保存済みのアクション表を、行数・列数が変わっても壊れないように整える
function normalizeActions(actions) {
  const base = createEmptyActions();
  if (!Array.isArray(actions)) return base;
  return base.map((row, wi) =>
    row.map((_, di) => {
      const v = actions[wi]?.[di];
      return v == null ? '' : String(v);
    })
  );
}

// 旧形式（good / bad / insight）で保存された記録を新形式へ読み替える
function migrateReview(review) {
  if (!review) return createEmptyMeeting().review;
  const { good, bad, insight, ...rest } = review;
  return {
    did: '', goodWhat: '', goodWhy: '', badWhat: '', badWhy: '', learning: '',
    ...rest,
    ...(good && !rest.goodWhat ? { goodWhat: good } : {}),
    ...(bad && !rest.badWhat ? { badWhat: bad } : {}),
    ...(insight && !rest.learning ? { learning: insight } : {}),
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

// 補聴器の年間販売累計。保存済みの他の月を合算し、編集中の当月分は画面の値を足す
function useYearHearingSales(staffName, month, currentMonthActual) {
  const [otherMonths, setOtherMonths] = useState(0);
  useEffect(() => {
    if (!staffName || !month) { setOtherMonths(0); return; }
    const year = month.split('-')[0];
    db.meetings
      .where('staffName').equals(staffName)
      .toArray()
      .then(recs => {
        // 同じ月に複数の記録があれば、最後に更新されたものだけを採用する
        const latestByMonth = new Map();
        recs
          .filter(r => r.month && r.month.startsWith(`${year}-`) && r.month !== month)
          .forEach(r => {
            const cur = latestByMonth.get(r.month);
            if (!cur || (r.updatedAt || 0) > (cur.updatedAt || 0)) latestByMonth.set(r.month, r);
          });
        const sum = [...latestByMonth.values()]
          .reduce((s, r) => s + (Number(r.results?.hearingSale?.actual) || 0), 0);
        setOtherMonths(sum);
      })
      .catch(() => setOtherMonths(0));
  }, [staffName, month]);

  return otherMonths + (Number(currentMonthActual) || 0);
}

// ========== メイン ==========

export default function App() {
  const [view, setView] = useState('editor');
  const [meeting, setMeeting] = useState(createEmptyMeeting());
  const [currentId, setCurrentId] = useState(null);

  const handleLoad = (record) => {
    const { id, createdAt, updatedAt, meetingNotes, ...data } = record;
    const base = createEmptyMeeting();
    setMeeting({
      ...base,
      ...data,
      staffName: data.staffName || base.staffName,
      results: migrateResults(data.results),
      actions: normalizeActions(data.actions),
      voices: data.voices || '',
      review: migrateReview(data.review),
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
    ALL_RESULT_KEYS.forEach(item => {
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
  const conversion = hearingConversion(meeting.results);
  const yearHearingSales = useYearHearingSales(
    meeting.staffName,
    meeting.month,
    meeting.results?.hearingSale?.actual
  );

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
  // 担当営業を選んだら、空欄の金額目標に50期の数字を入れる
  const selectStaff = (name) =>
    setMeeting(prev => ({
      ...prev,
      staffName: name,
      results: applyPeriodGoals(prev.results, name),
    }));
  const resetPeriodGoals = () =>
    setMeeting(prev => ({
      ...prev,
      results: applyPeriodGoals(prev.results, prev.staffName, { force: true }),
    }));
  const updateAction = (weekIndex, dayIndex, value) =>
    setMeeting(prev => ({
      ...prev,
      actions: prev.actions.map((week, wi) =>
        wi === weekIndex ? week.map((cell, di) => (di === dayIndex ? value : cell)) : week
      ),
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
                  onClick={() => selectStaff(name)}
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
        <SectionCard number="2" title="実績" subtitle="金額（用品・レンタル新規額・住宅改修）と、その裏づけになる件数">
          <div className="space-y-2">
            {/* 金額：会社の実績表と同じ 目標 / 実績 / あと / 達成率 */}
            <div className="grid grid-cols-[1fr_104px_104px_84px_52px] gap-2 text-xs font-semibold text-gray-600 px-1">
              <span>金額（税抜）</span>
              <span className="text-center">目標</span>
              <span className="text-center">実績</span>
              <span className="text-center">あと</span>
              <span className="text-center">達成率</span>
            </div>
            {MONEY_ITEMS.map(item => {
              const r = meeting.results[item.key] || { goal: '', actual: '' };
              const rate = achievementRate(r.goal, r.actual);
              const rest = remaining(r.goal, r.actual);
              return (
                <div key={item.key} className="grid grid-cols-[1fr_104px_104px_84px_52px] gap-2 items-center">
                  <span className="font-bold text-sm text-gray-800 pl-1">{item.label}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={r.goal}
                    onChange={e => updateResult(item.key, 'goal', e.target.value)}
                    placeholder="0"
                    className="border rounded-lg px-2 py-2 text-sm text-right bg-gray-50"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    value={r.actual}
                    onChange={e => updateResult(item.key, 'actual', e.target.value)}
                    placeholder="0"
                    className="border rounded-lg px-2 py-2 text-sm text-right font-bold"
                  />
                  <span className={`text-right text-sm pr-1 ${rest === null ? 'text-gray-400' : rest < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {rest === null ? '─' : `${rest > 0 ? '+' : ''}${yen(rest)}`}
                  </span>
                  <span className={`text-center text-sm font-bold ${rateColor(rate)}`}>
                    {rate === null ? '─' : `${rate}%`}
                  </span>
                </div>
              );
            })}

            {MONTHLY_GOALS[meeting.staffName] && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <p className="text-xs text-gray-500">
                  目標は{PERIOD_LABEL}の固定値です（店目標：用品{yen(STORE_GOALS.goodsYen)}／レンタル{yen(STORE_GOALS.rentalYen)}／住改{yen(STORE_GOALS.renovationYen)}）
                </p>
                <button
                  onClick={resetPeriodGoals}
                  className="shrink-0 text-xs font-bold text-gray-600 border border-gray-300 rounded-lg px-2.5 py-1.5 active:opacity-60"
                >
                  目標を入れ直す
                </button>
              </div>
            )}

            {/* 件数：先月と今月を並べて動きを見る */}
            <div className="pt-3">
              <div className="grid grid-cols-[1fr_66px_66px] gap-2 text-xs font-semibold text-gray-600 px-1 pb-1">
                <span>件数　<span className="font-normal text-gray-400">★＝会社の重点項目</span></span>
                <span className="text-center">先月</span>
                <span className="text-center">今月</span>
              </div>
              <div className="space-y-2">
                {COUNT_ITEMS.map(item => {
                  const r = meeting.results[item.key] || { goal: '', actual: '' };
                  const prevActual = prevRecord?.results?.[item.key]?.actual;
                  return (
                    <div key={item.key} className="grid grid-cols-[1fr_66px_66px] gap-2 items-center">
                      <span className="font-bold text-sm text-gray-800 pl-1">
                        {item.focus && <span className="text-amber-500 mr-0.5">★</span>}
                        {item.label}
                        <span className="text-xs text-gray-400 font-normal ml-1">({item.unit})</span>
                      </span>
                      <span className="text-center text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg py-2">
                        {prevActual !== undefined && prevActual !== '' ? prevActual : '─'}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={r.actual}
                        onChange={e => updateResult(item.key, 'actual', e.target.value)}
                        placeholder="0"
                        className="border rounded-lg px-2 py-2 text-base text-center"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-gray-400 pt-1">
              ※先月の数字は、同じ氏名で保存された前月のシートから自動表示されます
            </p>

            {/* 補聴器：測定 → 販売 の流れで追う */}
            <div className="rounded-lg border-2 border-indigo-300 bg-indigo-50 p-3 mt-3 space-y-2">
              <p className="font-bold text-sm text-indigo-900">補聴器</p>

              {HEARING_ITEMS.map(item => {
                const r = meeting.results[item.key] || { goal: '', actual: '' };
                const rate = achievementRate(r.goal, r.actual);
                const prevActual = prevRecord?.results?.[item.key]?.actual;
                return (
                  <div key={item.key} className="grid grid-cols-[1fr_70px_70px_70px_60px] gap-2 items-center">
                    <span className="font-bold text-sm text-gray-800 pl-1">
                      {item.focus && <span className="text-amber-500 mr-0.5">★</span>}
                      {item.label}
                      <span className="text-xs text-gray-400 font-normal ml-1">({item.unit})</span>
                    </span>
                    <span className="text-center text-sm text-gray-500 bg-white border border-gray-200 rounded-lg py-2">
                      {prevActual !== undefined && prevActual !== '' ? prevActual : '─'}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={r.goal}
                      onChange={e => updateResult(item.key, 'goal', e.target.value)}
                      placeholder="0"
                      className="border rounded-lg px-2 py-2 text-base text-center bg-white"
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      value={r.actual}
                      onChange={e => updateResult(item.key, 'actual', e.target.value)}
                      placeholder="0"
                      className="border rounded-lg px-2 py-2 text-base text-center bg-white"
                    />
                    <span className={`text-center text-sm font-bold ${rateColor(rate)}`}>
                      {rate === null ? '─' : `${rate}%`}
                    </span>
                  </div>
                );
              })}

              <div className="flex items-center justify-between border-t border-indigo-200 pt-2">
                <span className="text-sm font-bold text-indigo-900">
                  成約率
                  <span className="text-xs font-normal text-indigo-700 ml-1">測定のうち販売になった割合</span>
                </span>
                <span className="text-lg font-bold text-indigo-900">
                  {conversion === null ? '─' : `${conversion}%`}
                </span>
              </div>

              <div className="flex items-center justify-between border-t-2 border-indigo-400 pt-2">
                <span className="text-sm font-bold text-indigo-900">
                  {meeting.month ? meeting.month.split('-')[0] : ''}年の販売累計
                </span>
                <span className="text-2xl font-bold text-indigo-900">
                  {yearHearingSales}<span className="text-sm ml-1">台</span>
                </span>
              </div>

              <p className="text-xs text-indigo-700">
                ※累計は、同じ担当営業で保存された今年のシートを自動集計しています
              </p>
            </div>
          </div>
        </SectionCard>

        {/* 3. アクション数 */}
        <SectionCard
          number="3"
          title="アクション数"
          subtitle={`日々の営業活動の回数　1日${ACTION_DAY_GOAL}アクション／週${ACTION_WEEK_GOAL}アクションが目標`}
          accent="border-purple-400"
        >
          <ActionGrid
            weeks={meeting.actions}
            onChange={(wi, di, v) => updateAction(wi, di, v)}
          />
        </SectionCard>

        {/* 4. ケアマネ・ご家族の声 */}
        <SectionCard number="4" title="ケアマネ・ご家族からの声" subtitle="現場で聞いた情報・ご意見" accent="border-sky-400">
          <TextField
            label={VOICE_FIELD.label}
            hint={VOICE_FIELD.hint}
            placeholder={VOICE_FIELD.placeholder}
            value={meeting.voices}
            onChange={v => update('voices', v)}
            rows={5}
          />
        </SectionCard>

        {/* 3. その他の目標と結果 */}
        <SectionCard number="5" title="その他の目標と結果" subtitle="上記以外の目標があれば自由に追加">
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
        <SectionCard number="6" title="今月の振り返り" subtitle="事実を書いたら、必ず「なぜ？」まで掘り下げる" accent="border-orange-400">
          <TextField
            label={DID_FIELD.label}
            placeholder={DID_FIELD.placeholder}
            value={meeting.review.did}
            onChange={v => updateNested('review', DID_FIELD.key, v)}
            rows={3}
          />

          {REVIEW_PAIRS.map(pair => (
            <div
              key={pair.key}
              className={`rounded-lg border-2 p-3 space-y-2 ${
                pair.tone === 'good' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
              }`}
            >
              <p className={`font-bold text-sm ${pair.tone === 'good' ? 'text-green-800' : 'text-red-800'}`}>
                {pair.title}
              </p>
              <TextField
                label={pair.what.label}
                placeholder={pair.what.placeholder}
                value={meeting.review[pair.what.key]}
                onChange={v => updateNested('review', pair.what.key, v)}
                rows={3}
                bare
              />
              <div className="flex items-center gap-2 pl-1">
                <span className="text-lg leading-none">↓</span>
                <span className="text-xs font-bold text-gray-500">ここで止めずに、なぜかを考える</span>
              </div>
              <TextField
                label={pair.why.label}
                placeholder={pair.why.placeholder}
                value={meeting.review[pair.why.key]}
                onChange={v => updateNested('review', pair.why.key, v)}
                rows={3}
                bare
              />
            </div>
          ))}

          <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3">
            <TextField
              label={LEARNING_FIELD.label}
              placeholder={LEARNING_FIELD.placeholder}
              value={meeting.review.learning}
              onChange={v => updateNested('review', LEARNING_FIELD.key, v)}
              rows={3}
              bare
            />
            <p className="text-xs text-amber-800 mt-1">
              ※ここが一番大事です。今月の経験を、来月も再現できる「自分の言葉」に変えておきます。
            </p>
          </div>
        </SectionCard>

        {/* 5. 全体共有 */}
        <SectionCard number="7" title="全体共有" subtitle="誰かを責めるのではなく、市川店として前に進むために" accent="border-green-500">
          {SHARE_FIELDS.map(f => (
            <TextField key={f.key} label={f.label} placeholder={f.placeholder}
              value={meeting.share[f.key]} onChange={v => updateNested('share', f.key, v)} rows={3} />
          ))}
        </SectionCard>

        {/* 6. 来月の行動 */}
        <SectionCard number="8" title="来月の行動" subtitle="学びを、来月の具体的な動きに変える" accent="border-blue-500">
          {NEXT_FIELDS.map(f => (
            <TextField key={f.key} label={f.label} hint={f.hint} placeholder={f.placeholder}
              value={meeting.next[f.key]} onChange={v => updateNested('next', f.key, v)} rows={3} />
          ))}
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

// 月〜土 × 5週のアクション数入力表。週合計・曜日合計・総合計を自動集計する
function ActionGrid({ weeks, onChange }) {
  const grand = actionGrandTotal(weeks);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-center">
        <thead>
          <tr>
            <th className="text-xs font-semibold text-gray-600 pb-1 w-10"></th>
            {ACTION_DAYS.map(d => (
              <th key={d} className="text-xs font-semibold text-gray-600 pb-1">{d}</th>
            ))}
            <th className="text-xs font-semibold text-gray-600 pb-1 w-14">週計</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => {
            const total = actionWeekTotal(weeks, wi);
            const reached = total !== null && total >= ACTION_WEEK_GOAL;
            return (
              <tr key={wi}>
                <td className="text-xs font-bold text-gray-500 pr-1">{wi + 1}週</td>
                {week.map((cell, di) => (
                  <td key={di} className="p-0.5">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={cell}
                      onChange={e => onChange(wi, di, e.target.value)}
                      className={`w-full border rounded px-0.5 py-2 text-base text-center ${
                        cell !== '' && Number(cell) >= ACTION_DAY_GOAL
                          ? 'bg-green-50 border-green-400 font-bold'
                          : ''
                      }`}
                    />
                  </td>
                ))}
                <td className={`text-sm font-bold ${total === null ? 'text-gray-400' : reached ? 'text-green-600' : 'text-red-600'}`}>
                  {total ?? '─'}
                </td>
              </tr>
            );
          })}
          <tr>
            <td className="text-xs font-bold text-gray-500 pr-1 pt-1">曜日計</td>
            {ACTION_DAYS.map((_, di) => {
              const t = actionDayTotal(weeks, di);
              return (
                <td key={di} className="text-sm font-bold text-gray-700 pt-1">{t ?? '─'}</td>
              );
            })}
            <td className="text-base font-bold text-gray-900 pt-1">{grand ?? '─'}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-2">
        ※1日{ACTION_DAY_GOAL}アクション以上のマスは緑になります。週計は{ACTION_WEEK_GOAL}以上で緑、未満は赤。
      </p>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, rows = 2, hint, bare }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-0.5">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`w-full border rounded-lg px-3 py-2 text-base ${bare ? 'bg-white' : ''}`}
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
  // 先月の学びを持ち越して表示する（旧形式で保存された記録にも対応）
  const prevLearning = prevRecord ? migrateReview(prevRecord.review).learning : '';
  const conversion = hearingConversion(meeting.results);
  const yearHearingSales = useYearHearingSales(
    meeting.staffName,
    meeting.month,
    meeting.results?.hearingSale?.actual
  );

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
        style={{ width: '420mm', minHeight: '297mm', padding: '7mm 11mm', fontSize: '10pt', color: '#111' }}
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
                  <th className="border border-gray-400 px-1 py-0.5 w-6"></th>
                  <th className="border border-gray-400 px-1.5 py-0.5 text-left">居宅介護支援事業所名 / 担当ケアマネ</th>
                  <th className="border border-gray-400 px-1 py-0.5 w-14">目標<br />訪問数</th>
                  <th className="border border-gray-400 px-1 py-0.5 w-14">実際の<br />訪問数</th>
                  <th className="border border-gray-400 px-1 py-0.5 w-14">達成率</th>
                </tr>
              </thead>
              <tbody>
                {meeting.targets.map((t, i) => {
                  const rate = achievementRate(t.goalVisits, t.actualVisits);
                  return (
                    <tr key={i}>
                      <td className="border border-gray-400 px-1 py-0.5 text-center font-bold">{i + 1}</td>
                      <td className="border border-gray-400 px-1.5 py-0.5">
                        <div>{t.name}</div>
                        {t.careManager && (
                          <div className="text-gray-600" style={{ fontSize: '8pt' }}>CM：{t.careManager}</div>
                        )}
                      </td>
                      <td className="border border-gray-400 px-1 py-0.5 text-center">{t.goalVisits !== '' ? t.goalVisits : ''}</td>
                      <td className="border border-gray-400 px-1 py-0.5 text-center">{t.actualVisits !== '' ? t.actualVisits : ''}</td>
                      <td className={`border border-gray-400 px-1 py-0.5 text-center font-bold ${rateColor(rate)}`}>
                        {rate === null ? '' : `${rate}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <PrintSectionTitle number="2" title="実績（税抜）" />
            <table className="w-full border-collapse" style={{ fontSize: '9pt' }}>
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-1.5 py-0.5 text-left">金額</th>
                  <th className="border border-gray-400 px-1 py-0.5 w-16">先月</th>
                  <th className="border border-gray-400 px-1 py-0.5 w-16">目標</th>
                  <th className="border border-gray-400 px-1 py-0.5 w-16">実績</th>
                  <th className="border border-gray-400 px-1 py-0.5 w-16">あと</th>
                  <th className="border border-gray-400 px-1 py-0.5 w-12">達成率</th>
                </tr>
              </thead>
              <tbody>
                {MONEY_ITEMS.map(item => {
                  const r = meeting.results[item.key] || { goal: '', actual: '' };
                  const rate = achievementRate(r.goal, r.actual);
                  const rest = remaining(r.goal, r.actual);
                  return (
                    <tr key={item.key}>
                      <td className="border border-gray-400 px-1.5 py-0.5 font-bold">{item.label}</td>
                      <td className="border border-gray-400 px-1 py-0.5 text-right text-gray-500">
                        {yen(prevRecord?.results?.[item.key]?.actual)}
                      </td>
                      <td className="border border-gray-400 px-1 py-0.5 text-right text-gray-600">{yen(r.goal)}</td>
                      <td className="border border-gray-400 px-1 py-0.5 text-right font-bold">{yen(r.actual)}</td>
                      <td className={`border border-gray-400 px-1 py-0.5 text-right ${rest === null ? '' : rest < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {rest === null ? '' : `${rest > 0 ? '+' : ''}${yen(rest)}`}
                      </td>
                      <td className={`border border-gray-400 px-1 py-0.5 text-center font-bold ${rateColor(rate)}`}>
                        {rate === null ? '' : `${rate}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* 件数：先月と今月を横に並べ、2列に折り返して縦を詰める */}
            <table className="w-full border-collapse mt-1" style={{ fontSize: '7.5pt' }}>
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-1.5 py-0.5 text-left">件数</th>
                  <th className="border border-gray-400 px-1 py-0.5 w-9">先月</th>
                  <th className="border border-gray-400 px-1 py-0.5 w-9">今月</th>
                  <th className="border border-gray-400 px-1.5 py-0.5 text-left">件数</th>
                  <th className="border border-gray-400 px-1 py-0.5 w-9">先月</th>
                  <th className="border border-gray-400 px-1 py-0.5 w-9">今月</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.ceil(COUNT_ITEMS.length / 2) }, (_, row) => {
                  const pair = [COUNT_ITEMS[row * 2], COUNT_ITEMS[row * 2 + 1]];
                  return (
                    <tr key={row}>
                      {pair.map((item, i) => {
                        if (!item) {
                          return (
                            <td key={`empty-${i}`} className="border border-gray-400 px-1 py-0.5" colSpan={3} />
                          );
                        }
                        const r = meeting.results[item.key] || { goal: '', actual: '' };
                        const prevActual = prevRecord?.results?.[item.key]?.actual;
                        return (
                          <Fragment key={item.key}>
                            <td className="border border-gray-400 px-1.5 py-0.5 font-bold">
                              {item.focus && <span className="text-amber-600">★</span>}
                              {item.short || item.label}
                              <span className="font-normal text-gray-500">（{item.unit}）</span>
                            </td>
                            <td className="border border-gray-400 px-1 py-0.5 text-center text-gray-600">
                              {prevActual !== undefined && prevActual !== '' ? prevActual : ''}
                            </td>
                            <td className="border border-gray-400 px-1 py-0.5 text-center font-bold">
                              {r.actual !== '' ? r.actual : ''}
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* 補聴器：測定 → 販売 → 年間累計 */}
            <div className="border-2 border-indigo-500 rounded mt-1.5 overflow-hidden">
              <p className="px-2 py-0.5 font-bold bg-indigo-100 text-indigo-900" style={{ fontSize: '9pt' }}>
                補聴器
              </p>
              <table className="w-full border-collapse" style={{ fontSize: '9pt' }}>
                <tbody>
                  {HEARING_ITEMS.map(item => {
                    const r = meeting.results[item.key] || { goal: '', actual: '' };
                    const rate = achievementRate(r.goal, r.actual);
                    const prevActual = prevRecord?.results?.[item.key]?.actual;
                    return (
                      <tr key={item.key}>
                        <td className="border border-indigo-200 px-1.5 py-0.5 font-bold">
                          {item.focus && <span className="text-amber-600">★</span>}
                          {item.label}<span className="font-normal text-gray-500">（{item.unit}）</span>
                        </td>
                        <td className="border border-indigo-200 px-1 py-0.5 text-center text-gray-600 w-16">
                          {prevActual !== undefined && prevActual !== '' ? prevActual : ''}
                        </td>
                        <td className="border border-indigo-200 px-1 py-0.5 text-center w-14">{r.goal !== '' ? r.goal : ''}</td>
                        <td className="border border-indigo-200 px-1 py-0.5 text-center font-bold w-14">{r.actual !== '' ? r.actual : ''}</td>
                        <td className={`border border-indigo-200 px-1 py-0.5 text-center font-bold w-14 ${rateColor(rate)}`}>
                          {rate === null ? '' : `${rate}%`}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-indigo-50">
                    <td className="border border-indigo-200 px-1.5 py-0.5 font-bold" colSpan={3}>
                      成約率<span className="font-normal text-gray-600" style={{ fontSize: '7.5pt' }}>（測定のうち販売）</span>
                    </td>
                    <td className="border border-indigo-200 px-1 py-0.5 text-center font-bold" colSpan={2}>
                      {conversion === null ? '' : `${conversion}%`}
                    </td>
                  </tr>
                  <tr className="bg-indigo-100">
                    <td className="border-2 border-indigo-500 px-1.5 py-0.5 font-bold" colSpan={3}>
                      {meeting.month ? meeting.month.split('-')[0] : ''}年の販売累計
                    </td>
                    <td className="border-2 border-indigo-500 px-1 py-0.5 text-center font-bold" colSpan={2} style={{ fontSize: '10.5pt' }}>
                      {yearHearingSales} 台
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <PrintSectionTitle number="3" title={`アクション数（1日${ACTION_DAY_GOAL}／週${ACTION_WEEK_GOAL}が目標）`} />
            <PrintActionGrid weeks={meeting.actions} />

            <PrintSectionTitle number="4" title="ケアマネ・ご家族からの声" />
            <PrintBox
              label={VOICE_FIELD.label}
              hint={VOICE_FIELD.hint}
              value={meeting.voices}
              minHeight="25mm"
              sky
            />

          </div>

          {/* 中央：その他の目標 → 今月の振り返り（事実 → なぜ） */}
          <div>
            {meeting.goals.some(g => g.item || g.goal || g.result) && (
              <div className="mb-1.5">
                <PrintSectionTitle number="5" title="その他の目標と結果" />
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
                        <td className="border border-gray-400 px-1.5 py-1">{g.item}</td>
                        <td className="border border-gray-400 px-1 py-1 text-center">{g.goal}</td>
                        <td className="border border-gray-400 px-1 py-1 text-center">{g.result}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <PrintSectionTitle number="6" title="今月の振り返り" />

            {prevLearning && (
              <div className="border border-amber-400 rounded px-2 py-1 mb-1.5" style={{ background: '#fffbeb' }}>
                <p className="font-bold text-amber-900" style={{ fontSize: '7.5pt' }}>
                  先月の学び（{formatMonth(prevMonthOf(meeting.month))}）─ 今月これを実践できた？
                </p>
                <p className="text-gray-800" style={{ fontSize: '9pt', whiteSpace: 'pre-wrap' }}>{prevLearning}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <PrintBox label={DID_FIELD.label} value={meeting.review.did} minHeight="24mm" />

              {REVIEW_PAIRS.map(pair => (
                <PrintReflectionPair
                  key={pair.key}
                  title={pair.title}
                  tone={pair.tone}
                  whatLabel={pair.what.label}
                  whatValue={meeting.review[pair.what.key]}
                  whyLabel={pair.why.label}
                  whyValue={meeting.review[pair.why.key]}
                />
              ))}
            </div>
          </div>

          {/* 右：学び → 全体共有 → 来月の行動 */}
          <div>
            <PrintSectionTitle number="7" title="今月の学び" />
            <div
              className="border-2 border-amber-500 rounded overflow-hidden"
              style={{ background: '#fffbeb' }}
            >
              <p className="px-2 py-0.5 font-bold bg-amber-100 text-amber-900" style={{ fontSize: '8.5pt' }}>
                {LEARNING_FIELD.label}
              </p>
              <p className="px-2 py-1" style={{ minHeight: '30mm', fontSize: '10pt', whiteSpace: 'pre-wrap' }}>
                {meeting.review.learning}
              </p>
            </div>

            <PrintSectionTitle number="8" title="全体共有" />
            <div className="space-y-1.5">
              {SHARE_FIELDS.map(f => (
                <PrintBox key={f.key} label={f.label} value={meeting.share[f.key]} minHeight="17mm" />
              ))}
            </div>

            <PrintSectionTitle number="9" title="来月の行動" />
            <div className="space-y-1.5">
              {NEXT_FIELDS.map(f => (
                <PrintBox
                  key={f.key}
                  label={f.label}
                  hint={f.hint}
                  value={meeting.next[f.key]}
                  minHeight="26mm"
                  green={f.key !== 'challenge'}
                  highlight={f.key === 'challenge'}
                />
              ))}
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="mt-2 pt-1.5 border-t border-gray-300 text-center text-gray-500" style={{ fontSize: '8pt' }}>
          振り返りは「過去を責める時間」ではなく「未来を良くする時間」／チャレンジは、うまくいかなくても収穫です
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

// アクション数（月〜土 × 5週）の印刷用。週計・曜日計・総計つき
function PrintActionGrid({ weeks }) {
  const grand = actionGrandTotal(weeks);
  const cell = 'border border-gray-400 text-center';
  return (
    <table className="w-full border-collapse" style={{ fontSize: '8pt' }}>
      <thead>
        <tr className="bg-gray-100">
          <th className={`${cell} py-0.5 w-8`}></th>
          {ACTION_DAYS.map(d => (
            <th key={d} className={`${cell} py-0.5`}>{d}</th>
          ))}
          <th className={`${cell} py-0.5 w-10`}>週計</th>
        </tr>
      </thead>
      <tbody>
        {weeks.map((week, wi) => {
          const total = actionWeekTotal(weeks, wi);
          const reached = total !== null && total >= ACTION_WEEK_GOAL;
          return (
            <tr key={wi}>
              <td className={`${cell} py-1 font-bold bg-gray-50`}>{wi + 1}</td>
              {week.map((v, di) => {
                const hit = v !== '' && Number(v) >= ACTION_DAY_GOAL;
                return (
                  <td key={di} className={`${cell} py-1 ${hit ? 'bg-green-50 font-bold' : ''}`}>
                    {v === '' ? '' : v}
                  </td>
                );
              })}
              <td className={`${cell} py-1 font-bold ${total === null ? '' : reached ? 'text-green-600' : 'text-red-600'}`}>
                {total ?? ''}
              </td>
            </tr>
          );
        })}
        <tr className="bg-gray-100">
          <td className={`${cell} py-1 font-bold`} style={{ fontSize: '7pt' }}>計</td>
          {ACTION_DAYS.map((_, di) => (
            <td key={di} className={`${cell} py-1 font-bold`}>{actionDayTotal(weeks, di) ?? ''}</td>
          ))}
          <td className={`${cell} py-1 font-bold`} style={{ fontSize: '10pt' }}>{grand ?? ''}</td>
        </tr>
      </tbody>
    </table>
  );
}

function PrintBox({ label, hint, value, minHeight, green, highlight, sky }) {
  const border = highlight
    ? 'border-blue-600'
    : sky
      ? 'border-sky-500'
      : green
        ? 'border-green-600'
        : 'border-gray-400';
  const head = highlight
    ? 'bg-blue-50 text-blue-900'
    : sky
      ? 'bg-sky-50 text-sky-900'
      : green
        ? 'bg-green-50 text-green-800'
        : 'bg-gray-100 text-gray-700';
  return (
    <div className={`border rounded overflow-hidden ${border} ${highlight ? 'border-2' : ''}`}>
      <div className={`px-2 py-0.5 ${head}`}>
        <p className="font-bold" style={{ fontSize: '8.5pt' }}>{label}</p>
        {hint && <p style={{ fontSize: '7pt' }} className="opacity-80">{hint}</p>}
      </div>
      <p className="px-2 py-1" style={{ minHeight, fontSize: '10pt', whiteSpace: 'pre-wrap' }}>{value}</p>
    </div>
  );
}

// 「何が起きたか」→「なぜそうなったか」を1つの枠にまとめて、因果が見える形にする
function PrintReflectionPair({ title, tone, whatLabel, whatValue, whyLabel, whyValue }) {
  const good = tone === 'good';
  return (
    <div className={`border-2 rounded overflow-hidden ${good ? 'border-green-600' : 'border-red-500'}`}>
      <p
        className={`px-2 py-0.5 font-bold ${good ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}
        style={{ fontSize: '9pt' }}
      >
        {title}
      </p>

      <div className="px-2 pt-1">
        <p className="font-bold text-gray-600" style={{ fontSize: '7.5pt' }}>{whatLabel}</p>
        <p style={{ minHeight: '28mm', fontSize: '10pt', whiteSpace: 'pre-wrap' }}>{whatValue}</p>
      </div>

      <div className={`flex items-center gap-1 px-2 ${good ? 'text-green-700' : 'text-red-700'}`}>
        <span style={{ fontSize: '9pt', lineHeight: 1 }}>▼</span>
        <span className="font-bold" style={{ fontSize: '7.5pt' }}>なぜ？</span>
        <span className="flex-1 border-t border-dashed border-gray-400" />
      </div>

      <div className="px-2 pb-1 pt-0.5">
        <p className="font-bold text-gray-600" style={{ fontSize: '7.5pt' }}>{whyLabel}</p>
        <p style={{ minHeight: '32mm', fontSize: '10pt', whiteSpace: 'pre-wrap' }}>{whyValue}</p>
      </div>
    </div>
  );
}
