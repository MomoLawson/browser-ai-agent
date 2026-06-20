import type { BAIAppService, ServiceStatus, RouteHandler } from './types'

/**
 * 服务注册中心
 *
 * 管理所有 BAI 服务的注册、启用/禁用、路由分发。
 */
class ServiceRegistry {
  private services = new Map<string, BAIAppService>()
  private routeCache: Record<string, RouteHandler> | null = null

  /** 注册一个服务 */
  register(service: BAIAppService): void {
    this.services.set(service.name, service)
    this.routeCache = null  // 路由变化，清除缓存
    console.log(`[Registry] Registered service: ${service.name}`)
  }

  /** 启用服务 */
  async enable(name: string): Promise<void> {
    const svc = this.services.get(name)
    if (!svc) throw new Error(`Unknown service: ${name}`)
    if (svc.enabled) return
    svc.enabled = true
    await svc.start()
    this.routeCache = null
    console.log(`[Registry] Enabled: ${name}`)
  }

  /** 禁用服务 */
  async disable(name: string): Promise<void> {
    const svc = this.services.get(name)
    if (!svc) throw new Error(`Unknown service: ${name}`)
    if (!svc.enabled) return
    svc.enabled = false
    await svc.stop()
    this.routeCache = null
    console.log(`[Registry] Disabled: ${name}`)
  }

  /** 切换服务状态 */
  async toggle(name: string): Promise<boolean> {
    const svc = this.services.get(name)
    if (!svc) throw new Error(`Unknown service: ${name}`)
    if (svc.enabled) {
      await this.disable(name)
      return false
    } else {
      await this.enable(name)
      return true
    }
  }

  /** 获取所有服务状态 */
  getStatuses(): ServiceStatus[] {
    return Array.from(this.services.values()).map(s => s.getStatus())
  }

  /** 获取指定服务 */
  get(name: string): BAIAppService | undefined {
    return this.services.get(name)
  }

  /**
   * 匹配路由并返回 handler
   * 格式: "GET /health" → handler
   */
  matchRoute(method: string, pathname: string): RouteHandler | null {
    if (!this.routeCache) this.rebuildRouteCache()
    const key = `${method.toUpperCase()} ${pathname}`
    return this.routeCache![key] || null
  }

  private rebuildRouteCache(): void {
    this.routeCache = {}
    for (const svc of this.services.values()) {
      if (!svc.enabled) continue
      for (const [key, handler] of Object.entries(svc.getRoutes())) {
        this.routeCache[key] = handler
      }
    }
  }

  /** 启动所有 enabled 的服务 */
  async startAll(): Promise<void> {
    for (const svc of this.services.values()) {
      if (svc.enabled) {
        try {
          await svc.start()
          console.log(`[Registry] Started: ${svc.name}`)
        } catch (err: any) {
          console.error(`[Registry] Failed to start ${svc.name}:`, err.message)
        }
      }
    }
  }

  /** 停止所有服务 */
  async stopAll(): Promise<void> {
    for (const svc of this.services.values()) {
      try {
        await svc.stop()
      } catch {}
    }
  }
}

export const registry = new ServiceRegistry()
