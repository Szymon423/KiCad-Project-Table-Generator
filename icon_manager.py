import customtkinter as ctk
from PIL import Image
import cairosvg
from io import BytesIO
import os

class IconManager:
    """Menedżer ikon - konwertuje SVG do CTkImage"""
    
    def __init__(self, icons_dir="assets/icons"):
        self.icons_dir = icons_dir
        self.cache = {}
        
    def get(self, name, size=20, color="#FFFFFF"):
        """
        Pobiera ikonę i konwertuje do CTkImage
        
        Args:
            name: nazwa pliku bez rozszerzenia (np. "settings")
            size: rozmiar ikony w pikselach
            color: kolor ikony w formacie hex
        """
        cache_key = f"{name}_{size}_{color}"
        
        # Sprawdź cache
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        # Szukaj pliku SVG
        svg_path = os.path.join(self.icons_dir, f"{name}.svg")
        
        if not os.path.exists(svg_path):
            print(f"⚠️ Ikona nie znaleziona: {svg_path}")
            return None
        
        try:
            # Wczytaj SVG
            with open(svg_path, 'r', encoding='utf-8') as f:
                svg_data = f.read()
            
            # Zmień kolor (Lucide używa 'currentColor')
            svg_data = svg_data.replace('currentColor', color)
            svg_data = svg_data.replace('stroke="black"', f'stroke="{color}"')
            
            # Konwertuj SVG do PNG
            png_data = cairosvg.svg2png(
                bytestring=svg_data.encode('utf-8'),
                output_width=size,
                output_height=size
            )
            
            # Utwórz obraz PIL
            img = Image.open(BytesIO(png_data))
            
            # Utwórz CTkImage (dla light i dark mode)
            ctk_img = ctk.CTkImage(
                light_image=img,
                dark_image=img,
                size=(size, size)
            )
            
            # Zapisz w cache
            self.cache[cache_key] = ctk_img
            
            return ctk_img
            
        except Exception as e:
            print(f"❌ Błąd ładowania ikony {name}: {e}")
            return None
    
    def get_light_dark(self, name, size=20, light_color="#000000", dark_color="#FFFFFF"):
        """Pobiera ikonę z różnymi kolorami dla light/dark mode"""
        cache_key = f"{name}_{size}_{light_color}_{dark_color}"
        
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        svg_path = os.path.join(self.icons_dir, f"{name}.svg")
        
        if not os.path.exists(svg_path):
            print(f"⚠️ Ikona nie znaleziona: {svg_path}")
            return None
        
        try:
            with open(svg_path, 'r', encoding='utf-8') as f:
                svg_data = f.read()
            
            # Light version
            svg_light = svg_data.replace('currentColor', light_color)
            png_light = cairosvg.svg2png(
                bytestring=svg_light.encode('utf-8'),
                output_width=size,
                output_height=size
            )
            img_light = Image.open(BytesIO(png_light))
            
            # Dark version
            svg_dark = svg_data.replace('currentColor', dark_color)
            png_dark = cairosvg.svg2png(
                bytestring=svg_dark.encode('utf-8'),
                output_width=size,
                output_height=size
            )
            img_dark = Image.open(BytesIO(png_dark))
            
            # CTkImage z oboma wersjami
            ctk_img = ctk.CTkImage(
                light_image=img_light,
                dark_image=img_dark,
                size=(size, size)
            )
            
            self.cache[cache_key] = ctk_img
            return ctk_img
            
        except Exception as e:
            print(f"❌ Błąd: {e}")
            return None
