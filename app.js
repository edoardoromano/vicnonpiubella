const URL='./zoologia_questions_topics_2000.json';
let data,selected=new Set(),bank=[];
fetch(URL).then(r=>r.json()).then(d=>{data=d;render();});
function render(){
 const tl=document.getElementById('topic-list');
 data.topics.forEach(t=>{
  const l=document.createElement('label');
  l.innerHTML=`<input type=checkbox value=${t.id}> ${t.label}`;
  l.querySelector('input').onchange=e=>{
    e.target.checked?selected.add(t.id):selected.delete(t.id);
  };
  tl.appendChild(l); tl.appendChild(document.createElement('br'));
 });
 document.getElementById('start').onclick=start;
}
function start(){
 bank=data.questions.filter(q=>selected.has(q.topic));
 const q=bank.sort(()=>0.5-Math.random()).slice(0,20);
 const div=document.getElementById('quiz'); div.innerHTML='';
 q.forEach((x,i)=>{
  div.innerHTML+=`<p>${i+1}. ${x.question}</p>`;
  x.options.forEach(o=>div.innerHTML+=`<label><input type=radio name=${x.id}> ${o}</label><br>`);
 });
}
