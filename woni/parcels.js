/* ===== Mock parcels for the TEST build =====
   Anchored on real VWorld building centroids in Gupo-dong.
   payType: PP 선불 | CC 착불(COD) | PART 부분결제 | CR 신용 | ETC 기타
   Real data later comes from Hanjin core-proclst. */
window.MOCK_PARCELS=[
  // 백양대로 1176 (6 floors) — 3 parcels
  {id:'A1',lat:35.207278,lng:129.005187,road:'부산 북구 백양대로 1176',dtl:'301호',name:'김민수',payType:'PP',amount:0,instr:''},
  {id:'A2',lat:35.207278,lng:129.005187,road:'부산 북구 백양대로 1176',dtl:'502호',name:'이정호',payType:'CC',amount:4500,instr:'전화주세요'},
  {id:'A3',lat:35.207278,lng:129.005187,road:'부산 북구 백양대로 1176',dtl:'지하 1호',name:'박상철',payType:'PART',amount:2000,total:5000,instr:'첫번째 문, 부재시 문앞에 놓아주세요'},
  // 백양대로 1178 (7 floors) — 2 parcels
  {id:'B1',lat:35.207463,lng:129.005273,road:'부산 북구 백양대로 1178',dtl:'701호',name:'최영희',payType:'CR',amount:0,instr:''},
  {id:'B2',lat:35.207463,lng:129.005273,road:'부산 북구 백양대로 1178',dtl:'203호',name:'정다은',payType:'ETC',amount:0,instr:'사내판매'},
  // 덕천로 5 (7 floors) — 2 parcels
  {id:'C1',lat:35.207388,lng:129.005558,road:'부산 북구 덕천로 5',dtl:'402호',name:'한지민',payType:'PP',amount:0,instr:''},
  {id:'C2',lat:35.207388,lng:129.005558,road:'부산 북구 덕천로 5',dtl:'605호',name:'오세훈',payType:'CC',amount:12000,instr:'부재시 경비실에 맡겨주세요'},
  // 덕천로 21 (2 floors) — 1 parcel
  {id:'D1',lat:35.207891,lng:129.007211,road:'부산 북구 덕천로 21',dtl:'1층',name:'윤서연',payType:'CC',amount:3000,instr:'첫번째 문, 전화 후 배송'}
];
