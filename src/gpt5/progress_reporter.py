"""
Progress Reporting System for GPT-5 Pipeline
Provides real-time progress updates and CLI integration.
"""

import sys
import time
from typing import Dict, List, Optional, TextIO
from datetime import datetime, timedelta
from dataclasses import dataclass
from rich.console import Console
from rich.progress import Progress, TaskID, BarColumn, TextColumn, TimeRemainingColumn
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.live import Live
import threading

from .status_manager import StatusManager, ProcessingStage, ProcessingStatus


@dataclass
class ProgressMetrics:
    """Metrics for progress reporting."""
    total_items: int
    completed_items: int
    failed_items: int
    processing_items: int
    average_processing_time: float
    estimated_time_remaining: float
    current_stage_distribution: Dict[str, int]
    error_rate: float
    throughput: float  # items per minute


class ProgressReporter:
    """Handles progress reporting for GPT-5 pipeline."""

    def __init__(self, status_manager: StatusManager, console: Optional[Console] = None):
        self.status_manager = status_manager
        self.console = console or Console()
        self.start_time = datetime.now()
        self.last_update = datetime.now()
        self.update_interval = 1.0  # seconds
        self.running = False
        self.progress_task: Optional[TaskID] = None
        self._lock = threading.Lock()

    def start_monitoring(self, total_items: Optional[int] = None):
        """Start monitoring progress."""
        with self._lock:
            self.running = True
            self.start_time = datetime.now()

            if total_items:
                self.console.print(f"[bold green]Starting GPT-5 processing for {total_items} items...")
            else:
                self.console.print("[bold green]Starting GPT-5 processing...")

    def stop_monitoring(self):
        """Stop monitoring progress."""
        with self._lock:
            self.running = False
            self.console.print("[bold green]GPT-5 processing completed!")

    def get_current_metrics(self) -> ProgressMetrics:
        """Get current progress metrics."""
        all_status = self.status_manager.get_all_status()

        total_items = len(all_status)
        completed_items = len([s for s in all_status if s.current_stage == ProcessingStage.COMPLETED])
        failed_items = len([s for s in all_status if s.current_stage == ProcessingStage.FAILED])
        processing_items = total_items - completed_items - failed_items

        # Calculate stage distribution
        stage_distribution = {}
        for stage in ProcessingStage:
            count = len([s for s in all_status if s.current_stage == stage])
            if count > 0:
                stage_distribution[stage.value] = count

        # Calculate average processing time
        completed_statuses = [s for s in all_status if s.is_completed]
        if completed_statuses:
            avg_time = sum(s.processing_time.total_seconds() for s in completed_statuses) / len(completed_statuses)
        else:
            avg_time = 0.0

        # Calculate estimated time remaining
        if completed_items > 0 and processing_items > 0:
            estimated_remaining = (processing_items * avg_time) / 60  # minutes
        else:
            estimated_remaining = 0.0

        # Calculate error rate
        error_rate = (failed_items / total_items * 100) if total_items > 0 else 0.0

        # Calculate throughput (items per minute)
        elapsed_minutes = (datetime.now() - self.start_time).total_seconds() / 60
        throughput = completed_items / elapsed_minutes if elapsed_minutes > 0 else 0.0

        return ProgressMetrics(
            total_items=total_items,
            completed_items=completed_items,
            failed_items=failed_items,
            processing_items=processing_items,
            average_processing_time=avg_time,
            estimated_time_remaining=estimated_remaining,
            current_stage_distribution=stage_distribution,
            error_rate=error_rate,
            throughput=throughput
        )

    def create_progress_table(self, metrics: ProgressMetrics) -> Table:
        """Create a rich table showing current progress."""
        table = Table(title="GPT-5 Processing Progress")

        table.add_column("Metric", style="cyan", no_wrap=True)
        table.add_column("Value", style="magenta")
        table.add_column("Details", style="green")

        # Overall progress
        completion_rate = (metrics.completed_items / metrics.total_items * 100) if metrics.total_items > 0 else 0
        table.add_row(
            "Overall Progress",
            f"{metrics.completed_items}/{metrics.total_items}",
            f"{completion_rate:.1f}% complete"
        )

        # Status breakdown
        table.add_row(
            "Status",
            f"✅ {metrics.completed_items} | ❌ {metrics.failed_items} | 🔄 {metrics.processing_items}",
            f"Error rate: {metrics.error_rate:.1f}%"
        )

        # Performance metrics
        table.add_row(
            "Performance",
            f"{metrics.throughput:.1f} items/min",
            f"Avg time: {metrics.average_processing_time:.1f}s"
        )

        # Time estimates
        elapsed = datetime.now() - self.start_time
        table.add_row(
            "Time",
            f"Elapsed: {str(elapsed).split('.')[0]}",
            f"ETA: {metrics.estimated_time_remaining:.1f}m"
        )

        # Current stage distribution
        if metrics.current_stage_distribution:
            stage_details = []
            for stage, count in metrics.current_stage_distribution.items():
                if count > 0:
                    stage_details.append(f"{stage}: {count}")

            table.add_row(
                "Active Stages",
                str(len(metrics.current_stage_distribution)),
                " | ".join(stage_details[:3])  # Show first 3 stages
            )

        return table

    def create_stage_breakdown_panel(self, metrics: ProgressMetrics) -> Panel:
        """Create a panel showing detailed stage breakdown."""
        stage_text = Text()

        for stage, count in metrics.current_stage_distribution.items():
            if count > 0:
                # Color code stages
                if stage == ProcessingStage.COMPLETED.value:
                    color = "green"
                elif stage == ProcessingStage.FAILED.value:
                    color = "red"
                elif stage in [ProcessingStage.INITIALIZATION.value, ProcessingStage.CONTENT_EXTRACTION.value]:
                    color = "blue"
                elif stage in [ProcessingStage.ENRICHMENT.value, ProcessingStage.NOTION_FORMATTING.value]:
                    color = "yellow"
                else:
                    color = "white"

                stage_text.append(f"{stage}: {count}\n", style=color)

        return Panel(stage_text, title="Stage Distribution", border_style="blue")

    def update_progress_display(self, live_display: Optional[Live] = None):
        """Update the progress display."""
        metrics = self.get_current_metrics()

        # Create main progress table
        progress_table = self.create_progress_table(metrics)

        # Create stage breakdown panel
        stage_panel = self.create_stage_breakdown_panel(metrics)

        # Combine displays
        display_table = Table.grid()
        display_table.add_column()
        display_table.add_row(progress_table)
        display_table.add_row("")
        display_table.add_row(stage_panel)

        if live_display:
            live_display.update(display_table)
        else:
            self.console.clear()
            self.console.print(display_table)

    def run_live_progress(self, update_interval: float = 2.0):
        """Run live progress display in a separate thread."""
        with Live(self.console.print("Initializing..."), refresh_per_second=1, console=self.console) as live:
            while self.running:
                try:
                    self.update_progress_display(live)
                    time.sleep(update_interval)
                except KeyboardInterrupt:
                    self.running = False
                    break
                except Exception as e:
                    self.console.print(f"[red]Error updating progress: {e}")
                    time.sleep(update_interval)

    def print_summary_report(self):
        """Print a final summary report."""
        metrics = self.get_current_metrics()
        elapsed = datetime.now() - self.start_time

        summary_table = Table(title="GPT-5 Processing Summary")
        summary_table.add_column("Metric", style="cyan")
        summary_table.add_column("Value", style="green")

        summary_table.add_row("Total Items Processed", str(metrics.total_items))
        summary_table.add_row("Successfully Completed", str(metrics.completed_items))
        summary_table.add_row("Failed", str(metrics.failed_items))
        summary_table.add_row("Success Rate", f"{(metrics.completed_items / metrics.total_items * 100):.1f}%" if metrics.total_items > 0 else "0%")
        summary_table.add_row("Total Processing Time", str(elapsed).split('.')[0])
        summary_table.add_row("Average Throughput", f"{metrics.throughput:.2f} items/min")
        summary_table.add_row("Average Item Time", f"{metrics.average_processing_time:.2f}s")

        self.console.print("\n")
        self.console.print(summary_table)

    def log_error_summary(self):
        """Log a summary of errors encountered."""
        all_status = self.status_manager.get_all_status()

        # Collect all errors
        all_errors = []
        for status in all_status:
            all_errors.extend(status.errors)

        if not all_errors:
            self.console.print("[green]No errors encountered during processing!")
            return

        # Group errors by type
        error_counts = {}
        for error in all_errors:
            error_key = f"{error.stage.value}:{error.error_type}"
            error_counts[error_key] = error_counts.get(error_key, 0) + 1

        # Create error summary table
        error_table = Table(title="Error Summary")
        error_table.add_column("Stage", style="cyan")
        error_table.add_column("Error Type", style="yellow")
        error_table.add_column("Count", style="red")
        error_table.add_column("Severity", style="magenta")

        for error_key, count in sorted(error_counts.items(), key=lambda x: x[1], reverse=True):
            stage, error_type = error_key.split(':', 1)

            # Find a sample error for severity
            sample_error = next(e for e in all_errors if e.stage.value == stage and e.error_type == error_type)

            error_table.add_row(stage, error_type, str(count), sample_error.severity.value)

        self.console.print("\n")
        self.console.print(error_table)

    def export_progress_json(self, filename: str):
        """Export progress data to JSON file."""
        import json

        metrics = self.get_current_metrics()
        report_data = {
            "generated_at": datetime.now().isoformat(),
            "processing_started": self.start_time.isoformat(),
            "metrics": {
                "total_items": metrics.total_items,
                "completed_items": metrics.completed_items,
                "failed_items": metrics.failed_items,
                "processing_items": metrics.processing_items,
                "average_processing_time": metrics.average_processing_time,
                "estimated_time_remaining": metrics.estimated_time_remaining,
                "error_rate": metrics.error_rate,
                "throughput": metrics.throughput,
                "stage_distribution": metrics.current_stage_distribution
            }
        }

        with open(filename, 'w') as f:
            json.dump(report_data, f, indent=2)

        self.console.print(f"[green]Progress report exported to {filename}")


class CLIProgressHandler:
    """CLI integration for progress reporting."""

    def __init__(self, status_manager: StatusManager):
        self.status_manager = status_manager
        self.reporter = ProgressReporter(status_manager)

    def run_with_progress(self, processing_function, total_items: Optional[int] = None,
                         live_updates: bool = True, update_interval: float = 2.0):
        """Run processing function with progress monitoring."""
        self.reporter.start_monitoring(total_items)

        if live_updates:
            # Start progress monitoring in background thread
            progress_thread = threading.Thread(
                target=self.reporter.run_live_progress,
                args=(update_interval,)
            )
            progress_thread.daemon = True
            progress_thread.start()

        try:
            # Run the actual processing
            result = processing_function()

            # Stop monitoring
            self.reporter.stop_monitoring()

            if live_updates:
                progress_thread.join(timeout=1.0)

            # Print final reports
            self.reporter.print_summary_report()
            self.reporter.log_error_summary()

            return result

        except Exception as e:
            self.reporter.stop_monitoring()
            self.reporter.console.print(f"[red]Processing failed: {e}")
            raise

    def print_status_overview(self):
        """Print a quick status overview."""
        metrics = self.reporter.get_current_metrics()
        table = self.reporter.create_progress_table(metrics)
        self.reporter.console.print(table)