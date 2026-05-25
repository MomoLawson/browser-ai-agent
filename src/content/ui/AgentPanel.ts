/**
 * AgentPanel — 状态面板，内联 Lucide SVG 图标（无 CDN）。
 */
const CSS = `
*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans SC',sans-serif}
.overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;animation:fadeIn .12s ease}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.panel{width:380px;max-width:92vw;background:#fff;border-radius:14px;box-shadow:0 8px 36px rgba(0,0,0,.2);display:flex;flex-direction:column;animation:slideUp .15s ease}
@keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
.hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e2e8f0;cursor:move;flex-shrink:0}
.hdr-l{display:flex;align-items:center;gap:6px;font-weight:600;font-size:15px;color:#1a1a2e}
.hdr-r{display:flex;gap:4px}
.hdr-r button{width:28px;height:28px;border:none;border-radius:6px;background:transparent;color:#94a3b8;cursor:pointer;display:flex;align-items:center;justify-content:center}
.hdr-r button:hover{background:#f1f5f9;color:#475569}
.body{padding:16px}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;flex-shrink:0}
.dot.idle{background:#94a3b8}.dot.listening{background:#22c55e}.dot.error{background:#ef4444}
.status{font-size:13px;color:#64748b;margin-bottom:14px}
.status-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f8fafc;border-radius:8px}
.row{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.info{flex:1;min-width:0;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.info.act{border-color:#6366f1;color:#1a1a2e}.info .lbl{color:#94a3b8;font-size:12px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:all .12s;white-space:nowrap;flex-shrink:0}
.btn:active{transform:scale(.96)}
.btn-p{background:#6366f1;color:#fff}.btn-p:hover{background:#4f46e5}
.btn-g{background:#22c55e;color:#fff}.btn-g:hover{background:#16a34a}
.btn-o{background:transparent;color:#64748b;border:1px solid #e2e8f0}.btn-o:hover{background:#f8fafc}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.svg-inline--fa{width:14px;height:14px;flex-shrink:0;display:inline-block}
.hdr-l .svg-inline--fa{width:18px;height:18px}
.hdr-r .svg-inline--fa{width:16px;height:16px}
.pblock{background:#fefce8;border:1px solid #fde68a;border-radius:10px;overflow:hidden;margin-bottom:12px}
.pblock.hidden{display:none}
.phdr{display:flex;align-items:center;gap:6px;padding:8px 12px;background:#fef3c7;font-size:12px;font-weight:600;color:#92400e}
.ptext{font-family:'SF Mono','Fira Code',monospace;font-size:12px;line-height:1.5;padding:10px 12px;background:#fffbeb;color:#1a1a2e;white-space:pre-wrap;max-height:120px;overflow-y:auto}
.pacts{display:flex;gap:6px;padding:8px 12px;background:#fef3c7;border-top:1px solid #fde68a}
.sp{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483648;background:#fff;border-radius:14px;box-shadow:0 8px 36px rgba(0,0,0,.25);padding:20px;width:300px;max-width:90vw}
.sp.hidden{display:none}
.sp h3{display:flex;align-items:center;gap:6px;margin:0 0 12px;font-size:15px;color:#1a1a2e}
.sp label{display:block;font-size:13px;color:#64748b;margin-bottom:6px}
.sp select{width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#1a1a2e;background:#fff;cursor:pointer}
.sp .sp-close{margin-top:14px;width:100%}
.log{margin-top:6px}.log-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
.log-t{display:flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:#64748b}
.log-b{max-height:140px;overflow-y:auto;background:#0f172a;border-radius:8px;padding:6px 8px;font-family:'SF Mono','Fira Code',monospace;font-size:11px;line-height:1.5}
.log-b .e{display:flex;gap:5px;word-break:break-all;padding:1px 0}
.log-b .t{color:#475569;flex-shrink:0}
.log-b .m.info{color:#7dd3fc}.log-b .m.success{color:#86efac}.log-b .m.error{color:#fca5a5}.log-b .m.warn{color:#fde68a}
.log-b .empty{color:#475569;text-align:center;padding:10px 0;font-size:12px}
.log-b::-webkit-scrollbar{width:4px}
.log-b::-webkit-scrollbar-thumb{background:#334155;border-radius:2px}
`
import { loadSettings, saveSettings, resolveLang, LANG_NAMES, type Lang } from '../settings'
import { fa, renderFA } from './icons'
type UILang='en-US'|'zh-CN'|'zh-TW'
const T:Record<UILang,Record<string,string>>={
  'en-US':{wa:'Waiting for project',se:'Select project',ns:'Not selected',sp:'Send prompt to AI',sa:'Send to AI',cp:'Copy',lg:'Logs',cl:'Clear',cd:'Cleared',ch:'Connect a project to see logs',st:'Settings',ll:'Language',cs:'Close',fd:'Sent to AI',co:'Copied',pj:'Project',fl:'Files',ls:'Listening',pr:'Prompt ready - copy and send'},
  'zh-CN':{wa:'等待连接项目',se:'选择项目',ns:'未选择',sp:'发送提示词给 AI',sa:'发送给 AI',cp:'复制',lg:'操作日志',cl:'清除',cd:'已清除',ch:'连接项目后这里显示操作记录',st:'设置',ll:'界面语言',cs:'关闭',fd:'已发送',co:'已复制',pj:'项目',fl:'文件',ls:'监听中',pr:'提示词已就绪 - 复制后发送'},
  'zh-TW':{wa:'等待連接專案',se:'選擇專案',ns:'未選擇',sp:'發送提示詞給 AI',sa:'發送給 AI',cp:'複製',lg:'操作日誌',cl:'清除',cd:'已清除',ch:'連接專案後這裡顯示操作記錄',st:'設定',ll:'介面語言',cs:'關閉',fd:'已發送',co:'已複製',pj:'專案',fl:'檔案',ls:'監聽中',pr:'提示詞已就緒 - 複製後傳送'},
}
type K=keyof typeof T['en-US']

export class AgentPanel{
  private host:HTMLElement;private shadow:ShadowRoot
  private dragging=false;private dOff={x:0,y:0};private lang:UILang='en-US'
  private elPane!:HTMLElement;private elSelect!:HTMLButtonElement;private elInfo!:HTMLElement
  private elLog!:HTMLElement;private elPrompt!:HTMLElement;private elPT!:HTMLElement
  private elStgBtn!:HTMLButtonElement;private elStgPnl!:HTMLElement;private elLang!:HTMLSelectElement
  private elST!:HTMLElement;private elDot!:HTMLElement
  onSelectProject?:()=>Promise<{name:string;fileCount:number}|null>
  onClose?:()=>void;onSendPrompt?:(t:string)=>void;onSettingsChange?:()=>void
  constructor(){const s=loadSettings();this.lang=resolveLang(s)as UILang;this.host=document.createElement('div');document.body.appendChild(this.host);this.shadow=this.host.attachShadow({mode:'open'});this.render();this.bindEvents()}
  private t(k:K){return T[this.lang][k]||T['en-US'][k]||k}
  private $(i:string){return this.shadow.getElementById(i)!}

  private render(){
    this.shadow.innerHTML=`<style>${CSS}</style>
<div class="overlay" id="ov"><div class="panel" id="pn">
<div class="hdr"><div class="hdr-l"><i class="${fa('bot')}"></i>BAI Agent</div><div class="hdr-r"><button id="stg" title="${this.t('st')}"><i class="${fa('settings')}"></i></button><button id="cl"><i class="${fa('x')}"></i></button></div></div>
<div class="body">
  <div class="status-bar"><span class="dot idle" id="dot"></span><span class="status" id="st">${this.t('wa')}</span></div>
  <div class="row"><button class="btn btn-p" id="sel"><i class="${fa('folderOpen')}"></i>${this.t('se')}</button><div class="info" id="info"><span class="lbl">${this.t('ns')}</span></div></div>
  <div class="pblock hidden" id="pb"><div class="phdr"><i class="${fa('messageSquare')}"></i>${this.t('sp')}</div><div class="ptext" id="pt"></div><div class="pacts"><button class="btn btn-g" id="ci"><i class="${fa('paperPlane')}"></i>${this.t('sa')}</button><button class="btn btn-o" id="cc"><i class="${fa('copy')}"></i>${this.t('cp')}</button></div></div>
  <div class="log"><div class="log-h"><span class="log-t"><i class="${fa('list')}"></i>${this.t('lg')}</span><button class="btn btn-o" id="clr" style="font-size:11px;padding:3px 8px"><i class="${fa('trash2')}"></i>${this.t('cl')}</button></div><div class="log-b" id="lb"><div class="empty">${this.t('ch')}</div></div></div>
</div></div>
<div class="sp hidden" id="sp"><h3><i class="${fa('sliders')}"></i>${this.t('st')}</h3><label>${this.t('ll')}</label><select id="langSel"></select><button class="btn btn-p sp-close" id="spCl"><i class="${fa('check')}"></i>${this.t('cs')}</button></div>`
    setTimeout(() => renderFA(this.shadow), 50)
    this.elPane=this.$('pn');this.elDot=this.$('dot');this.elSelect=this.$('sel')as HTMLButtonElement
    this.elInfo=this.$('info');this.elLog=this.$('lb');this.elPrompt=this.$('pb');this.elPT=this.$('pt')
    this.elST=this.$('st');this.elStgBtn=this.$('stg')as HTMLButtonElement
    this.elStgPnl=this.$('sp');this.elLang=this.$('langSel')as HTMLSelectElement
    const c=loadSettings().language
    this.elLang.innerHTML=Object.entries(LANG_NAMES).map(([k,v])=>`<option value="${k}"${k===c?' selected':''}>${v}</option>`).join('')
  }

  private rui(){
    this.elST.textContent=this.t('wa')
    this.elSelect.innerHTML=`<i class="${fa('folderOpen')}"></i>${this.t('se')}`
    this.$('ci').innerHTML=`<i class="${fa('paperPlane')}"></i>${this.t('sa')}`
    this.$('cc').innerHTML=`<i class="${fa('copy')}"></i>${this.t('cp')}`
    this.$('clr').innerHTML=`<i class="${fa('trash2')}"></i>${this.t('cl')}`
    const p=this.shadow.querySelector('.phdr');if(p)p.innerHTML=`<i class="${fa('messageSquare')}"></i>${this.t('sp')}`
    const lt=this.shadow.querySelector('.log-t');if(lt)lt.innerHTML=`<i class="${fa('list')}"></i>${this.t('lg')}`
    setTimeout(() => renderFA(this.shadow), 50)
  }

  private bindEvents(){
    const h=this.shadow.querySelector('.hdr')!
    h.addEventListener('mousedown',e=>{const m=e as MouseEvent;if((m.target as HTMLElement).closest('button'))return;this.dragging=true;this.dOff.x=m.clientX-this.elPane.offsetLeft;this.dOff.y=m.clientY-this.elPane.offsetTop})
    document.addEventListener('mousemove',e=>{const m=e as MouseEvent;if(!this.dragging)return;this.elPane.style.left=(m.clientX-this.dOff.x)+'px';this.elPane.style.top=(m.clientY-this.dOff.y)+'px';this.elPane.style.margin='0'})
    document.addEventListener('mouseup',()=>{this.dragging=false})
    this.$('cl').addEventListener('click',()=>this.onClose?.())
    this.$('ov').addEventListener('click',e=>{if(e.target===e.currentTarget)this.onClose?.()})
    this.elSelect.addEventListener('click',async()=>{if(!this.onSelectProject)return;this.elSelect.disabled=true;this.elSelect.textContent='...';try{const r=await this.onSelectProject();if(r)this.setProjectInfo(r.name,r.fileCount)}catch(e){this.addLog('error',`x ${(e as Error).message}`)}finally{this.elSelect.disabled=false;this.elSelect.innerHTML=`<i class="${fa('folderOpen')}"></i>${this.t('se')}`;setTimeout(()=>renderFA(this.shadow),50)}})
    this.$('clr').addEventListener('click',()=>this.clearLogs())
    this.$('ci').addEventListener('click',()=>{if(!this.elPT.textContent)return;this.onSendPrompt?.(this.elPT.textContent);this.addLog('success',this.t('fd'))})
    this.$('cc').addEventListener('click',()=>{const t=this.elPT.textContent;if(!t)return;navigator.clipboard.writeText(t).then(()=>this.addLog('success',this.t('co')))})
    this.elStgBtn.addEventListener('click',()=>{this.elStgPnl.classList.toggle('hidden')})
    this.elLang.addEventListener('change',()=>{const s=loadSettings();s.language=this.elLang.value as Lang;saveSettings(s);this.lang=resolveLang(s)as UILang;this.rui()})
    this.$('spCl').addEventListener('click',()=>{this.elStgPnl.classList.add('hidden');this.onSettingsChange?.()})
  }

  showPrompt(t:string):void{this.elPT.textContent=t;this.elPrompt.classList.remove('hidden')}
  setStatus(s:'idle'|'listening'|'error',t?:string):void{this.elDot.className=`dot ${s}`;this.elST.textContent=t||(s==='idle'?this.t('wa'):this.t('ls'))}
  setProjectInfo(n:string,c:number):void{this.elInfo.innerHTML=`<span class="lbl">${this.t('pj')}:</span> ${esc(n)} | <span class="lbl">${this.t('fl')}:</span> ${c}`;this.elInfo.classList.add('act')}
  addLog(t:'info'|'success'|'error'|'warn',m:string):void{const e=this.elLog.querySelector('.empty');if(e)e.remove();const d=document.createElement('div');d.className='e';d.innerHTML=`<span class="t">${tm()}</span><span class="m ${t}">${esc(m)}</span>`;this.elLog.appendChild(d);this.elLog.scrollTop=this.elLog.scrollHeight}
  clearLogs():void{this.elLog.innerHTML=`<div class="empty">${this.t('cd')}</div>`}
  updateStatusBar(t:string):void{this.elST.textContent=t}
  destroy():void{this.host.remove()}
}
function esc(s:string):string{const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function tm():string{return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
