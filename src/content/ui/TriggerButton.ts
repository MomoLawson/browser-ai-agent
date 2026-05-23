/**
 * TriggerButton — 浮动触发按钮
 *
 * 固定在页面右下角，点击后打开 AgentPanel。
 * 使用 Shadow DOM 隔离样式。
 */
const TRIGGER_CSS = `
:host{all:initial;display:block}
.btn{position:fixed;bottom:24px;right:24px;z-index:2147483646;width:44px;height:44px;border-radius:50%;border:none;background:#6366f1;color:#fff;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(99,102,241,.4);transition:all .2s;display:flex;align-items:center;justify-content:center;user-select:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:-.5px}
.btn:hover{transform:scale(1.1);box-shadow:0 6px 20px rgba(99,102,241,.5)}
.btn:active{transform:scale(.95)}
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
    this.shadow.innerHTML = `<style>${TRIGGER_CSS}</style><button class="btn" id="btn">BAI</button>`
    this.el = this.shadow.getElementById('btn')! as HTMLButtonElement
    this.el.addEventListener('click', () => this._onClick())
  }

  hide(): void { this.el.style.display = 'none' }
  show(): void { this.el.style.display = '' }

  destroy(): void { this.host.remove() }
}