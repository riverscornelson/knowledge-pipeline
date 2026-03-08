"""CLI entry point for the knowledge pipeline."""
import logging
import sys

from .config import PipelineConfig
from .pipeline import Pipeline


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    try:
        config = PipelineConfig.from_env()
    except KeyError as e:
        print(f"Missing required environment variable: {e}", file=sys.stderr)
        sys.exit(1)

    pipeline = Pipeline(config)

    if "--re-enrich" in sys.argv:
        dry_run = "--dry-run" in sys.argv
        pipeline.re_enrich(dry_run=dry_run)
    else:
        pipeline.run()


if __name__ == "__main__":
    main()
