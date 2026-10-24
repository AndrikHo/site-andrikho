/* ===== Shared helpers + i18n (ru/ko) =====
   Loaded first. app.js and draw.js rely on these globals. */
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const short=a=>(a||'').replace(/^부산(광역시)?\s+북구\s+/,'');
const r6=v=>+(+v).toFixed(6);
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let msgT;function msg(t,err,ms){const m=$('msg');m.textContent=t;m.className='glass'+(err?' err':'');clearTimeout(msgT);if(ms)msgT=setTimeout(()=>m.classList.add('hide'),ms)}

const I18N={
 ru:{
   h1:'Woni 택배',pp:'Предоплата',cc:'Наложка',part:'Частичная',cr:'Кредит',etc:'Прочее',done:'Доставлено',
   deliveredN:'доставлено',reset:'Сбросить тест',sdk_fail:'Карта не загрузилась. Проверь интернет.',
   hello:'Нажми на любой дом, чтобы увидеть адрес, посылки и заметки.',payL:{PP:'선불',CC:'착불',PART:'부분',CR:'신용',ETC:'기타'},
   won:'₩',deliverAll:'Доставить всё',undoAll:'Вернуть всё',more:'Развернуть',less:'Свернуть',
   noAddr:'Адрес не найден',noParcels:'Посылок нет',locale:'ru-RU',
   // notes
   notes_title:'Заметки',note_ph:'Например: код двери 1234#, оставлять у охраны',save:'Сохранить',note_del:'Удалить заметку',no_notes:'Заметок пока нет.',
   // account / modes
   acc:'Аккаунт',draw:'Рисовать',close_edit:'Закрыть редактирование',tools:'Инструменты',
   t_zone:'Граница участка',t_shape:'Фигуры',t_arrow:'Стрелки',t_font:'Шрифт',t_color:'Цвет и прозрачность',
   undo:'Назад',redo:'Вперёд',text:'Текст',text_ph:'Текст или цифры',from:'от',to:'до',del:'Удалить',cancel:'Отмена',ok:'Готово',
   login:'Войти',login_soon:'Вход скоро',login_emp:'Сабон (код сотрудника)',login_phone:'Телефон',login_pw:'Пароль',
   acc_p:'Логин для всех курьеров появится позже. Сейчас рисунки и заметки хранятся только на этом телефоне. Сохрани копию, чтобы не потерять их или перенести на другой телефон.',
   acc_clear:'Удалить все рисунки',acc_imp:'Загрузить копию',acc_exp:'Сохранить копию',close:'Закрыть',lang:'Язык',
   // editor hints
   h_idle:'Нажми на фигуру или стрелку, чтобы выбрать. Инструменты — справа.',
   h_zone:'Граница: наведи крестик на угол и нажми «Поставить точку». Точки можно двигать пальцем. Точек: {n}',
   put_pt:'Поставить точку',rm_pt:'Убрать точку',erase:'Стереть',sure_erase:'Точно стереть?',
   h_shape:'Нажми на карту, чтобы поставить фигуру «{x}».',h_arrow2:'Теперь нажми, куда указывает стрелка.',h_arrow:'Стрелка «{x}»: нажми, откуда, потом куда.',
   h_selshape:'Тяни — переместить. Двумя пальцами — размер. Цвет и шрифт — справа.',h_selarrow:'Тяни за середину — переместить, за конец — повернуть. Двумя пальцами — толщина.',
   numbers:'Цифры',unsel:'Снять выбор',txt_num:'Цифры на стрелке: от → до',txt_new:'Текст в фигуре',txt_edit:'Изменить текст',
   exp_ok:'Копия сохранена в «Загрузки».',imp_ok:'Копия загружена.',imp_bad:'Это не файл копии.',sure_del:'Точно удалить? Нажми ещё раз',
   cleared:'Рисунки удалены. Вернуть можно кнопкой «Назад» в режиме рисования.',
   // shapes / arrows / fonts
   f_sys:'Обычный',f_mono:'Моно 123',
   s_pin:'Метка',s_round:'Скруглённый',s_rect:'Прямоугольник',s_pill:'Капсула',s_ellipse:'Овал',s_flag:'Флажок',
   a_plain:'Обычная',a_thick:'Толстая',a_num:'С цифрами от–до',a_chev:'Стрелки по линии',a_dash:'Штрих-пунктир',
   shapes:'Фигуры',shapes_hint:'Выбери фигуру и нажми на карту. Фигура растёт по ширине вместе с текстом.',arrows:'Стрелки',font:'Шрифт',
   changes:'Меняется: {x}',bold:'Ж',italic:'К',horiz:'Обычно',vert:'Сверху вниз',spacing:'Между буквами',text_color:'Цвет текста',opacity:'Прозрачность',
   color:'Цвет',bright:'Яркость',tg_shape:'фигура',tg_arrow:'стрелка',tg_zone:'граница',tg_new:'новые фигуры и стрелки',tg_selshape:'выбранная фигура',tg_newshape:'новые фигуры',
   // search
   search_open:'Поиск',search_ph:'Адрес, дом или место',search:'Поиск',search_close:'Закрыть поиск',nothing:'На участке ничего не найдено',tag_note:'заметка'
 },
 ko:{
   h1:'Woni 택배',pp:'선불',cc:'착불',part:'부분결제',cr:'신용',etc:'기타',done:'배송완료',
   deliveredN:'배송완료',reset:'테스트 초기화',sdk_fail:'지도를 불러오지 못했습니다. 인터넷을 확인하세요.',
   hello:'아무 건물이나 누르면 주소, 택배, 메모가 보입니다.',payL:{PP:'선불',CC:'착불',PART:'부분',CR:'신용',ETC:'기타'},
   won:'원',deliverAll:'전체 배송완료',undoAll:'전체 취소',more:'더보기',less:'접기',
   noAddr:'주소 없음',noParcels:'택배 없음',locale:'ko-KR',
   notes_title:'메모',note_ph:'예: 공동현관 비밀번호 1234#, 경비실에 맡기기',save:'저장',note_del:'메모 삭제',no_notes:'아직 메모가 없습니다.',
   acc:'계정',draw:'그리기',close_edit:'편집 닫기',tools:'도구',
   t_zone:'구역 경계',t_shape:'도형',t_arrow:'화살표',t_font:'글꼴',t_color:'색상과 투명도',
   undo:'실행 취소',redo:'다시 실행',text:'텍스트',text_ph:'텍스트 또는 숫자',from:'부터',to:'까지',del:'삭제',cancel:'취소',ok:'완료',
   login:'로그인',login_soon:'로그인 준비 중',login_emp:'사번',login_phone:'전화번호',login_pw:'비밀번호',
   acc_p:'모든 기사용 로그인은 나중에 추가됩니다. 지금은 그림과 메모가 이 휴대폰에만 저장됩니다. 잃어버리지 않도록, 또는 다른 휴대폰으로 옮기려면 백업을 저장하세요.',
   acc_clear:'그림 모두 삭제',acc_imp:'백업 불러오기',acc_exp:'백업 저장',close:'닫기',lang:'언어',
   h_idle:'도형이나 화살표를 눌러 선택하세요. 도구는 오른쪽에 있습니다.',
   h_zone:'경계: 십자선을 모서리에 맞추고 「점 찍기」를 누르세요. 점은 손가락으로 옮길 수 있습니다. 점 {n}개',
   put_pt:'점 찍기',rm_pt:'점 빼기',erase:'지우기',sure_erase:'정말 지울까요?',
   h_shape:'지도를 눌러 「{x}」 도형을 놓으세요.',h_arrow2:'이제 화살표가 가리킬 곳을 누르세요.',h_arrow:'「{x}」 화살표: 시작점을 누른 뒤 끝점을 누르세요.',
   h_selshape:'끌어서 이동, 두 손가락으로 크기 조절. 색상과 글꼴은 오른쪽에 있습니다.',h_selarrow:'가운데를 끌면 이동, 끝을 끌면 방향 변경. 두 손가락으로 굵기 조절.',
   numbers:'숫자',unsel:'선택 해제',txt_num:'화살표 숫자: 부터 → 까지',txt_new:'도형 안 텍스트',txt_edit:'텍스트 수정',
   exp_ok:'백업이 「다운로드」에 저장되었습니다.',imp_ok:'백업을 불러왔습니다.',imp_bad:'백업 파일이 아닙니다.',sure_del:'정말 삭제할까요? 한 번 더 누르세요',
   cleared:'그림을 삭제했습니다. 그리기 모드의 「실행 취소」로 되돌릴 수 있습니다.',
   f_sys:'기본',f_mono:'고정폭 123',
   s_pin:'핀',s_round:'둥근 사각형',s_rect:'사각형',s_pill:'캡슐',s_ellipse:'타원',s_flag:'깃발',
   a_plain:'기본',a_thick:'굵은 화살표',a_num:'번호 (부터–까지)',a_chev:'연속 화살표',a_dash:'일점쇄선',
   shapes:'도형',shapes_hint:'도형을 고르고 지도를 누르세요. 글자 수에 따라 도형 너비가 늘어납니다.',arrows:'화살표',font:'글꼴',
   changes:'변경 대상: {x}',bold:'굵게',italic:'기울임',horiz:'가로쓰기',vert:'세로쓰기',spacing:'자간',text_color:'글자 색',opacity:'투명도',
   color:'색상',bright:'밝기',tg_shape:'도형',tg_arrow:'화살표',tg_zone:'구역 경계',tg_new:'새 도형과 화살표',tg_selshape:'선택한 도형',tg_newshape:'새 도형',
   search_open:'검색',search_ph:'주소, 건물 또는 장소',search:'검색',search_close:'검색 닫기',nothing:'구역 안에서 찾은 결과가 없습니다',tag_note:'메모'
 }
};
let LANG=store.get('woni-lang',null)||((navigator.language||'').toLowerCase().startsWith('ko')?'ko':'ru');
let T=I18N[LANG];
const tr=(k,v)=>{let s=(I18N[LANG]||I18N.ru)[k];if(s==null)s=I18N.ru[k]||k;if(v)for(const x in v)s=String(s).replace('{'+x+'}',v[x]);return s};
function setLang(l){LANG=l;T=I18N[LANG];store.set('woni-lang',LANG);applyLang()}
