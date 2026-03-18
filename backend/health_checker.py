"""
独立的探活后台服务
每 5 分钟对所有启用的上游供应商执行一次探活检查
"""
import asyncio
import logging
from database import SessionLocal
from models import Provider
from routers.providers import do_health_check

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def health_check_loop():
    """每 15 分钟对所有启用的上游做一次探活（跳过 skip_health_check=True 的上游）"""
    logger.info("Health checker service started")
    
    while True:
        await asyncio.sleep(900)  # 15 分钟
        db = SessionLocal()
        try:
            active_providers = db.query(Provider).filter(Provider.is_active == True).all()  # noqa: E712
            # 过滤掉跳过健康检查的上游
            providers_to_check = [p for p in active_providers if not getattr(p, 'skip_health_check', False)]
            logger.info(f"Starting health check for {len(providers_to_check)} active providers (skipped {len(active_providers) - len(providers_to_check)} with skip_health_check=True)")
            
            for p in providers_to_check:
                try:
                    await do_health_check(db, p)
                    logger.info(
                        f"[health] provider={p.name} success={p.last_check_success} "
                        f"latency={p.last_check_latency_ms}ms"
                    )
                except Exception as e:
                    logger.warning(f"[health] provider={p.name} error: {e}")
        except Exception as e:
            logger.error(f"Health check loop error: {e}")
        finally:
            db.close()


if __name__ == "__main__":
    asyncio.run(health_check_loop())
