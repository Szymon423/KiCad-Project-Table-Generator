"""
Konfiguracja aplikacji SMART Sensor Test Platform - Table Generator
"""
import os

# === ŚCIEŻKI ===
ASSETS_DIR = "./assets"
ICONS_DIR = os.path.join(ASSETS_DIR, "icons")
IMAGES_DIR = os.path.join(ASSETS_DIR, "images")
FONTS_DIR = os.path.join(ASSETS_DIR, "fonts")

DEFAULT_LOGO_PATH = os.path.join(IMAGES_DIR, "logo.png")
DEFAULT_FONT_PATH = os.path.join(FONTS_DIR, "segoeui.ttf")

# === KOLORY ===
COLORS = {
    "primary": "#3498db",
    "primary_hover": "#2980b9",
    "success": "#2ecc71",
    "success_hover": "#27ae60",
    "danger": "#e74c3c",
    "danger_hover": "#c0392b",
    "warning": "#f39c12",
    "info": "#9b59b6",
    "secondary": "#95a5a6",
    "secondary_hover": "#7f8c8d",
}

# === DOMYŚLNE WARTOŚCI GENERATORA ===
DEFAULTS = {
    "font_size": 150,
    "font_size_min": 50,
    "font_size_max": 300,
    "font_size_steps": 50,
    
    "line_width": 10,
    "line_width_min": 5,
    "line_width_max": 30,
    "line_width_steps": 25,
    
    "cell_padding": 40,
    "left_margin": 50,
}

# === OKNO APLIKACJI ===
WINDOW = {
    "title": "SMART Sensor Test Platform - Table Generator",
    "geometry": "1400x800",
    "theme": "dark",
    "color_theme": "blue",
}

# === IKONY ===
ICON_SIZES = {
    "small": 16,
    "medium": 20,
    "large": 28,
    "xlarge": 64,
}

# === PODGLĄD ===
PREVIEW = {
    "width": 600,
    "placeholder_text": "\n\nKliknij 'Generuj' aby zobaczyć podgląd",
}

# === KOMUNIKATY ===
MESSAGES = {
    "error_no_rows": "Dodaj przynajmniej jeden wiersz z tekstem!",
    "error_no_logo": "Wybierz prawidłowy plik logo!",
    "error_min_rows": "Musisz mieć przynajmniej jeden wiersz!",
    "error_save_failed": "Nie udało się zapisać obrazu:",
    "error_generate_failed": "Wystąpił błąd podczas generowania:",
    
    "success_generated": "Podgląd wygenerowany pomyślnie!",
    "success_saved": "Obraz zapisany:",
    
    "info_kicad": "Funkcja kopiowania do KiCad będzie dostępna w przyszłości.",
    "info_logo_loaded": "Załadowano domyślne logo:",
    "info_logo_not_found": "Domyślne logo nie znalezione:",
    "info_logo_load_failed": "Nie udało się załadować domyślnego logo:",
}

# === DIALOGI PLIKÓW ===
FILE_DIALOGS = {
    "logo": {
        "title": "Wybierz logo",
        "filetypes": [
            ("Pliki obrazów", "*.png *.jpg *.jpeg *.bmp"),
            ("Wszystkie pliki", "*.*")
        ]
    },
    "save": {
        "title": "Zapisz obraz",
        "defaultextension": ".png",
        "filetypes": [
            ("PNG", "*.png"),
            ("JPEG", "*.jpg"),
            ("Wszystkie pliki", "*.*")
        ]
    }
}
