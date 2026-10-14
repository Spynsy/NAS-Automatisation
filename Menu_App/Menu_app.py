"""Desktop launcher for the tools in this repository."""

import os
import subprocess
import sys
import tkinter as tk
from collections.abc import Callable
from pathlib import Path
from tkinter import messagebox


ROOT = Path(__file__).resolve().parent.parent
DOWNLOAD_DIR = ROOT / "Download_videos"
DOWNLOAD_EXECUTABLE = DOWNLOAD_DIR / "Download_videos.exe"
DOWNLOAD_SCRIPT = DOWNLOAD_DIR / "Download_videos.py"
RECIPE_WORKBOOK = ROOT / "Liste_course" / "Recipe.xlsx"

BACKGROUND = "#11131a"
CARD_BACKGROUND = "#20232d"
TEXT = "#f4f5f7"
MUTED = "#a7adbb"
ACCENT = "#8b7cff"


def draw_video_thumbnail(canvas: tk.Canvas) -> None:
    canvas.configure(bg="#29223c")
    canvas.create_oval(235, -55, 405, 115, fill="#423465", outline="")
    canvas.create_oval(-50, 90, 100, 240, fill="#352a50", outline="")
    canvas.create_rectangle(82, 30, 258, 134, fill="#f04455", outline="")
    canvas.create_polygon(153, 55, 153, 109, 199, 82, fill="white", outline="")
    canvas.create_text(
        170, 152, text="VIDEO", fill="#e1dafa",
        font=("Segoe UI", 10, "bold"),
    )


def draw_recipe_thumbnail(canvas: tk.Canvas) -> None:
    canvas.configure(bg="#203a35")
    canvas.create_oval(235, -60, 405, 110, fill="#31584c", outline="")
    canvas.create_oval(-60, 105, 90, 255, fill="#294b41", outline="")
    canvas.create_rectangle(98, 25, 242, 140, fill="#d9b783", outline="")
    canvas.create_oval(117, 39, 223, 137, fill="#f4eee0", outline="")
    canvas.create_oval(131, 50, 209, 126, fill="#88aa61", outline="")
    canvas.create_oval(145, 62, 178, 95, fill="#dd6552", outline="")
    canvas.create_oval(176, 88, 198, 111, fill="#e5b954", outline="")
    canvas.create_line(123, 133, 216, 133, fill="#b18b5d", width=3)
    canvas.create_text(
        170, 157, text="RECIPES", fill="#d5e9db",
        font=("Segoe UI", 10, "bold"),
    )


def main() -> None:
    root = tk.Tk()
    root.title("My app hub")
    root.configure(bg=BACKGROUND)
    root.geometry("900x620")
    root.minsize(760, 560)

    tk.Label(
        root, text="My app hub", bg=BACKGROUND, fg=TEXT,
        font=("Segoe UI", 27, "bold"),
    ).pack(anchor="w", padx=40, pady=(34, 4))
    tk.Label(
        root, text="Choose a tool to get started.", bg=BACKGROUND, fg=MUTED,
        font=("Segoe UI", 11),
    ).pack(anchor="w", padx=42, pady=(0, 25))

    cards = tk.Frame(root, bg=BACKGROUND)
    cards.pack(fill="both", expand=True, padx=40, pady=(0, 20))
    cards.columnconfigure((0, 1), weight=1, uniform="cards")
    cards.rowconfigure(0, weight=1)

    status = tk.StringVar(value="Ready")

    def show_error(title: str, error: OSError) -> None:
        status.set("Could not open the selected app.")
        messagebox.showerror(title, str(error), parent=root)

    def launch_downloader() -> None:
        if DOWNLOAD_EXECUTABLE.is_file():
            command = [str(DOWNLOAD_EXECUTABLE)]
        elif DOWNLOAD_SCRIPT.is_file():
            command = [sys.executable, str(DOWNLOAD_SCRIPT)]
        else:
            show_error(
                "App not found",
                FileNotFoundError(f"Could not find {DOWNLOAD_EXECUTABLE.name} or {DOWNLOAD_SCRIPT.name}."),
            )
            return

        try:
            subprocess.Popen(command, cwd=str(DOWNLOAD_DIR))
        except OSError as error:
            show_error("Could not launch video downloader", error)
            return
        status.set("Video downloader started.")

    def open_recipes() -> None:
        if not RECIPE_WORKBOOK.is_file():
            show_error(
                "Workbook not found",
                FileNotFoundError(f"Could not find {RECIPE_WORKBOOK}."),
            )
            return

        try:
            os.startfile(str(RECIPE_WORKBOOK))
        except OSError as error:
            show_error("Could not open recipe workbook", error)
            return
        status.set("Recipe workbook opened.")

    def add_card(
        column: int,
        title: str,
        description: str,
        action_text: str,
        action: Callable[[], None],
        draw_thumbnail: Callable[[tk.Canvas], None],
    ) -> None:
        card = tk.Frame(cards, bg=CARD_BACKGROUND, highlightthickness=1,
                        highlightbackground="#303440")
        card.grid(row=0, column=column, sticky="nsew",
                  padx=(0, 10) if column == 0 else (10, 0))

        thumbnail = tk.Canvas(card, height=185, highlightthickness=0)
        thumbnail.pack(fill="x")
        draw_thumbnail(thumbnail)

        tk.Label(
            card, text=title, bg=CARD_BACKGROUND, fg=TEXT,
            font=("Segoe UI", 16, "bold"),
        ).pack(anchor="w", padx=20, pady=(19, 5))
        tk.Label(
            card, text=description, bg=CARD_BACKGROUND, fg=MUTED,
            font=("Segoe UI", 10), justify="left", wraplength=310,
        ).pack(anchor="w", padx=20)

        tk.Button(
            card, text=action_text, command=action, bg=ACCENT, fg="white",
            activebackground="#7668e8", activeforeground="white",
            relief="flat", cursor="hand2", font=("Segoe UI", 10, "bold"),
            padx=16, pady=10,
        ).pack(anchor="w", padx=20, pady=(22, 20))

    add_card(
        0,
        "Video downloader",
        "Find new videos from your channels and choose which ones to download.",
        "Launch app",
        launch_downloader,
        draw_video_thumbnail,
    )
    add_card(
        1,
        "Recipes & shopping list",
        "Browse your recipe collection and meal-planning workbook.",
        "Open recipe workbook",
        open_recipes,
        draw_recipe_thumbnail,
    )

    tk.Label(
        root, textvariable=status, bg=BACKGROUND, fg=MUTED,
        font=("Segoe UI", 9),
    ).pack(anchor="w", padx=42, pady=(0, 20))

    root.mainloop()


if __name__ == "__main__":
    main()