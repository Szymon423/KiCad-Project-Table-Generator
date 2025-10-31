import customtkinter as ctk
from tkinter import filedialog, messagebox
from PIL import ImageTk
import os

from icon_manager import IconManager
from config import (
    WINDOW, COLORS, DEFAULTS, DEFAULT_LOGO_PATH, 
    MESSAGES, FILE_DIALOGS, PREVIEW
)
from table_generator import TableGenerator, create_preview, validate_inputs


class TableGeneratorApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        # Inicjalizacja menedżera ikon
        self.icons = IconManager("assets/icons")
        
        # Konfiguracja okna
        self.title(WINDOW["title"])
        self.geometry(WINDOW["geometry"])
        
        # Zmienne
        self.rows = []  # Lista wierszy (Entry widgets)
        self.logo_path = None
        self.preview_image = None
        self.generated_image = None
        
        # Konfiguracja siatki
        self.grid_columnconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)
        
        # Tworzenie interfejsu
        self.create_left_panel()
        self.create_right_panel()
        
        # Załaduj domyślne logo (jeśli istnieje)
        self.load_default_logo()
        
        # Dodaj domyślny wiersz
        self.add_row()
        
    def load_default_logo(self):
        """Ładuje domyślne logo z ./assets/images/logo.png"""
        if os.path.exists(DEFAULT_LOGO_PATH):
            try:
                self.logo_path = DEFAULT_LOGO_PATH
                self.logo_entry.configure(state="normal")
                self.logo_entry.delete(0, "end")
                self.logo_entry.insert(0, "logo.png (domyślne)")
                self.logo_entry.configure(state="readonly")
                print(f"{MESSAGES['info_logo_loaded']} {DEFAULT_LOGO_PATH}")
            except Exception as e:
                print(f"{MESSAGES['info_logo_load_failed']} {e}")
        else:
            print(f"{MESSAGES['info_logo_not_found']} {DEFAULT_LOGO_PATH}")
        
    def create_left_panel(self):
        """Panel konfiguracji (lewa strona)"""
        left_frame = ctk.CTkFrame(self, corner_radius=10)
        left_frame.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")
        left_frame.grid_rowconfigure(1, weight=1)
        left_frame.grid_columnconfigure(0, weight=1)
        
        # === NAGŁÓWEK ===
        header_frame = ctk.CTkFrame(left_frame, fg_color="transparent")
        header_frame.grid(row=0, column=0, padx=20, pady=(20, 10), sticky="w")
        
        header = ctk.CTkLabel(
            header_frame, 
            text="  Konfiguracja", 
            font=ctk.CTkFont(size=24, weight="bold"),
            image=self.icons.get("settings", size=28, color=COLORS["primary"]),
            compound="left"
        )
        header.pack(side="left")
        
        # === SCROLLABLE FRAME DLA WIERSZY ===
        rows_header_frame = ctk.CTkFrame(left_frame, fg_color="transparent")
        rows_header_frame.grid(row=1, column=0, padx=20, pady=(10, 5), sticky="w")
        
        rows_label = ctk.CTkLabel(
            rows_header_frame, 
            text="  Wiersze tabeli:", 
            font=ctk.CTkFont(size=16, weight="bold"),
            image=self.icons.get("file-text", size=20, color="#FFFFFF"),
            compound="left"
        )
        rows_label.pack(side="left")
        
        self.rows_frame = ctk.CTkScrollableFrame(left_frame, height=250)
        self.rows_frame.grid(row=2, column=0, padx=20, pady=(0, 10), sticky="ew")
        self.rows_frame.grid_columnconfigure(0, weight=1)
        
        # Przycisk dodawania wiersza
        add_btn = ctk.CTkButton(
            left_frame,
            text="  Dodaj wiersz",
            image=self.icons.get("plus", size=20, color="#FFFFFF"),
            compound="left",
            command=self.add_row,
            fg_color=COLORS["success"],
            hover_color=COLORS["success_hover"],
            height=40,
            font=ctk.CTkFont(size=13, weight="bold")
        )
        add_btn.grid(row=3, column=0, padx=20, pady=(0, 20), sticky="ew")
        
        # === SEPARATOR ===
        separator1 = ctk.CTkFrame(left_frame, height=2, fg_color="gray30")
        separator1.grid(row=4, column=0, padx=20, pady=10, sticky="ew")
        
        # === LOGO ===
        logo_header_frame = ctk.CTkFrame(left_frame, fg_color="transparent")
        logo_header_frame.grid(row=5, column=0, padx=20, pady=(10, 5), sticky="w")
        
        logo_label = ctk.CTkLabel(
            logo_header_frame, 
            text="  Logo:", 
            font=ctk.CTkFont(size=16, weight="bold"),
            image=self.icons.get("image", size=20, color="#FFFFFF"),
            compound="left"
        )
        logo_label.pack(side="left")
        
        self.logo_entry = ctk.CTkEntry(
            left_frame, 
            placeholder_text="Wybierz plik logo...",
            state="readonly",
            height=35
        )
        self.logo_entry.grid(row=6, column=0, padx=20, pady=(0, 5), sticky="ew")
        
        logo_btn = ctk.CTkButton(
            left_frame,
            text="  Wybierz logo",
            image=self.icons.get("folder", size=18, color="#FFFFFF"),
            compound="left",
            command=self.select_logo,
            height=35,
            font=ctk.CTkFont(size=13)
        )
        logo_btn.grid(row=7, column=0, padx=20, pady=(0, 10), sticky="ew")
        
        # === SEPARATOR ===
        separator2 = ctk.CTkFrame(left_frame, height=2, fg_color="gray30")
        separator2.grid(row=8, column=0, padx=20, pady=10, sticky="ew")
        
        # === GRUBOŚĆ LINII ===
        line_header_frame = ctk.CTkFrame(left_frame, fg_color="transparent")
        line_header_frame.grid(row=9, column=0, padx=20, pady=(10, 5), sticky="w")
        
        line_label = ctk.CTkLabel(
            line_header_frame, 
            text="  Grubość linii:", 
            font=ctk.CTkFont(size=16, weight="bold"),
            image=self.icons.get("sliders", size=18, color="#FFFFFF"),
            compound="left"
        )
        line_label.pack(side="left")
        
        self.line_width_slider = ctk.CTkSlider(
            left_frame,
            from_=DEFAULTS["line_width_min"],
            to=DEFAULTS["line_width_max"],
            number_of_steps=DEFAULTS["line_width_steps"],
            command=self.update_line_width_label
        )
        self.line_width_slider.set(DEFAULTS["line_width"])
        self.line_width_slider.grid(row=10, column=0, padx=20, pady=(0, 5), sticky="ew")
        
        self.line_width_label = ctk.CTkLabel(
            left_frame, 
            text=f"{DEFAULTS['line_width']} px",
            font=ctk.CTkFont(size=13)
        )
        self.line_width_label.grid(row=11, column=0, padx=20, pady=(0, 10))
        
        # === ROZMIAR CZCIONKI ===
        font_header_frame = ctk.CTkFrame(left_frame, fg_color="transparent")
        font_header_frame.grid(row=12, column=0, padx=20, pady=(10, 5), sticky="w")
        
        font_label = ctk.CTkLabel(
            font_header_frame, 
            text="  Rozmiar czcionki:", 
            font=ctk.CTkFont(size=16, weight="bold"),
            image=self.icons.get("type", size=18, color="#FFFFFF"),
            compound="left"
        )
        font_label.pack(side="left")
        
        self.font_size_slider = ctk.CTkSlider(
            left_frame,
            from_=DEFAULTS["font_size_min"],
            to=DEFAULTS["font_size_max"],
            number_of_steps=DEFAULTS["font_size_steps"],
            command=self.update_font_size_label
        )
        self.font_size_slider.set(DEFAULTS["font_size"])
        self.font_size_slider.grid(row=13, column=0, padx=20, pady=(0, 5), sticky="ew")
        
        self.font_size_label = ctk.CTkLabel(
            left_frame, 
            text=f"{DEFAULTS['font_size']} px",
            font=ctk.CTkFont(size=13)
        )
        self.font_size_label.grid(row=14, column=0, padx=20, pady=(0, 20))
        
    def create_right_panel(self):
        """Panel podglądu (prawa strona)"""
        right_frame = ctk.CTkFrame(self, corner_radius=10)
        right_frame.grid(row=0, column=1, padx=10, pady=10, sticky="nsew")
        right_frame.grid_rowconfigure(1, weight=1)
        right_frame.grid_columnconfigure(0, weight=1)
        
        # === NAGŁÓWEK ===
        header_frame = ctk.CTkFrame(right_frame, fg_color="transparent")
        header_frame.grid(row=0, column=0, padx=20, pady=(20, 10), sticky="w")
        
        header = ctk.CTkLabel(
            header_frame, 
            text="  Podgląd", 
            font=ctk.CTkFont(size=24, weight="bold"),
            image=self.icons.get("eye", size=28, color=COLORS["info"]),
            compound="left"
        )
        header.pack(side="left")
        
        # === PODGLĄD ===
        self.preview_frame = ctk.CTkFrame(right_frame, fg_color="gray20")
        self.preview_frame.grid(row=1, column=0, padx=20, pady=(0, 10), sticky="nsew")
        
        # Placeholder z ikoną
        placeholder_frame = ctk.CTkFrame(self.preview_frame, fg_color="transparent")
        placeholder_frame.place(relx=0.5, rely=0.5, anchor="center")
        
        self.preview_label = ctk.CTkLabel(
            placeholder_frame,
            text=PREVIEW["placeholder_text"],
            font=ctk.CTkFont(size=16),
            image=self.icons.get("image", size=64, color="gray50"),
            compound="top"
        )
        self.preview_label.pack(expand=True)
        
        # === PRZYCISKI ===
        buttons_frame = ctk.CTkFrame(right_frame, fg_color="transparent")
        buttons_frame.grid(row=2, column=0, padx=20, pady=(0, 20), sticky="ew")
        buttons_frame.grid_columnconfigure((0, 1, 2), weight=1)
        
        generate_btn = ctk.CTkButton(
            buttons_frame,
            text="  Generuj",
            image=self.icons.get("refresh", size=20, color="#FFFFFF"),
            compound="left",
            command=self.generate_preview,
            fg_color=COLORS["primary"],
            hover_color=COLORS["primary_hover"],
            height=45,
            font=ctk.CTkFont(size=14, weight="bold")
        )
        generate_btn.grid(row=0, column=0, padx=5, sticky="ew")
        
        save_btn = ctk.CTkButton(
            buttons_frame,
            text="  Zapisz",
            image=self.icons.get("save", size=20, color="#FFFFFF"),
            compound="left",
            command=self.save_image,
            fg_color=COLORS["success"],
            hover_color=COLORS["success_hover"],
            height=45,
            font=ctk.CTkFont(size=14, weight="bold")
        )
        save_btn.grid(row=0, column=1, padx=5, sticky="ew")
        
        copy_btn = ctk.CTkButton(
            buttons_frame,
            text="  Kopiuj",
            image=self.icons.get("copy", size=18, color="#FFFFFF"),
            compound="left",
            command=self.copy_to_kicad,
            fg_color=COLORS["secondary"],
            hover_color=COLORS["secondary_hover"],
            height=45,
            font=ctk.CTkFont(size=14, weight="bold"),
            state="disabled"
        )
        copy_btn.grid(row=0, column=2, padx=5, sticky="ew")
        
    def add_row(self):
        """Dodaje nowy wiersz do tabeli"""
        row_frame = ctk.CTkFrame(self.rows_frame)
        row_frame.grid(row=len(self.rows), column=0, pady=5, sticky="ew")
        row_frame.grid_columnconfigure(0, weight=1)
        
        entry = ctk.CTkEntry(
            row_frame,
            placeholder_text=f"Wiersz {len(self.rows) + 1}...",
            height=35,
            font=ctk.CTkFont(size=13)
        )
        entry.grid(row=0, column=0, padx=(0, 5), sticky="ew")
        
        delete_btn = ctk.CTkButton(
            row_frame,
            text="",
            image=self.icons.get("trash", size=18, color="#FFFFFF"),
            width=40,
            command=lambda: self.delete_row(row_frame, entry),
            fg_color=COLORS["danger"],
            hover_color=COLORS["danger_hover"]
        )
        delete_btn.grid(row=0, column=1)
        
        self.rows.append(entry)
        
    def delete_row(self, frame, entry):
        """Usuwa wiersz z tabeli"""
        if len(self.rows) <= 1:
            messagebox.showwarning("Uwaga", MESSAGES["error_min_rows"])
            return
        
        self.rows.remove(entry)
        frame.destroy()
        
    def select_logo(self):
        """Wybiera plik logo"""
        file_path = filedialog.askopenfilename(**FILE_DIALOGS["logo"])
        
        if file_path:
            self.logo_path = file_path
            self.logo_entry.configure(state="normal")
            self.logo_entry.delete(0, "end")
            self.logo_entry.insert(0, os.path.basename(file_path))
            self.logo_entry.configure(state="readonly")
            
    def update_line_width_label(self, value):
        """Aktualizuje etykietę grubości linii"""
        self.line_width_label.configure(text=f"{int(value)} px")
        
    def update_font_size_label(self, value):
        """Aktualizuje etykietę rozmiaru czcionki"""
        self.font_size_label.configure(text=f"{int(value)} px")
        
    def generate_preview(self):
        """Generuje podgląd tabeli"""
        # Pobierz dane
        texts = [row.get().strip() for row in self.rows if row.get().strip()]
        
        # Walidacja
        is_valid, error_msg = validate_inputs(texts, self.logo_path)
        if not is_valid:
            if "pusta" in error_msg:
                messagebox.showerror("Błąd", MESSAGES["error_no_rows"])
            else:
                messagebox.showerror("Błąd", MESSAGES["error_no_logo"])
            return
        
        try:
            # Utwórz generator z aktualnymi ustawieniami
            generator = TableGenerator(
                font_size=int(self.font_size_slider.get()),
                line_width=int(self.line_width_slider.get())
            )
            
            # Generuj obraz
            self.generated_image = generator.generate(texts, self.logo_path)
            
            # Utwórz podgląd
            preview = create_preview(self.generated_image, PREVIEW["width"])
            
            # Wyświetl podgląd
            photo = ImageTk.PhotoImage(preview)
            self.preview_label.configure(image=photo, text="")
            self.preview_label.image = photo
            
            # messagebox.showinfo("Sukces", MESSAGES["success_generated"])
            
        except Exception as e:
            messagebox.showerror(
                "Błąd", 
                f"{MESSAGES['error_generate_failed']}\n{str(e)}"
            )
            
    def save_image(self):
        """Zapisuje wygenerowany obraz"""
        if self.generated_image is None:
            messagebox.showerror("Błąd", "Najpierw wygeneruj obraz!")
            return
        
        file_path = filedialog.asksaveasfilename(**FILE_DIALOGS["save"])
        
        if file_path:
            try:
                self.generated_image.save(file_path)
                messagebox.showinfo(
                    "Sukces", 
                    f"{MESSAGES['success_saved']}\n{file_path}"
                )
            except Exception as e:
                messagebox.showerror(
                    "Błąd", 
                    f"{MESSAGES['error_save_failed']}\n{str(e)}"
                )
                
    def copy_to_kicad(self):
        """Placeholder dla funkcji kopiowania do KiCad"""
        messagebox.showinfo("W przygotowaniu", MESSAGES["info_kicad"])


if __name__ == "__main__":
    ctk.set_appearance_mode(WINDOW["theme"])
    ctk.set_default_color_theme(WINDOW["color_theme"])
    
    app = TableGeneratorApp()
    app.mainloop()
