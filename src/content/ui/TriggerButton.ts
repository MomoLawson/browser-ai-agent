/**
 * TriggerButton — 浮动触发按钮
 *
 * 固定在页面右下角，点击后打开 AgentPanel。
 * 使用 Shadow DOM 隔离样式，Lucide 图标。
 */
const TRIGGER_CSS = `
:host{all:initial;display:block}
.btn{position:fixed;bottom:24px;right:24px;z-index:2147483646;width:44px;height:44px;border-radius:50%;border:none;background:#6366f1;color:#fff;cursor:pointer;box-shadow:0 4px 14px rgba(99,102,241,.4);transition:all .2s;display:flex;align-items:center;justify-content:center;user-select:none}
.btn:hover{transform:scale(1.1);box-shadow:0 6px 20px rgba(99,102,241,.5)}
.btn:active{transform:scale(.95)}
.btn svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
`

export class TriggerButton {
  private host: HTMLElement
  private shadow: ShadowRoot
  private el: HTMLButtonElement
  private _onClick: () => void

  constructor(onClick: () => void) {
    this._onClick = onClick
    this.host = document.createElement('div')
    document.body.appendChild(this.host)
    this.shadow = this.host.attachShadow({ mode: 'open' })
    this.shadow.innerHTML = `<style>${TRIGGER_CSS}</style><button class="btn" id="btn">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
</button>`
    this.el = this.shadow.getElementById('btn')! as HTMLButtonElement
    this.el.addEventListener('click', () => this._onClick())
  }

  hide(): void { this.el.style.display = 'none' }
  show(): void { this.el.style.display = '' }

  destroy(): void { this.host.remove() }
}