"""
Moduł generowania tabel z logo
"""
from PIL import Image, ImageDraw, ImageFont
import os
from config import DEFAULTS, DEFAULT_FONT_PATH


class TableGenerator:
    """
    Klasa odpowiedzialna za generowanie obrazów tabel z logo.
    
    Attributes:
        font_size (int): Rozmiar czcionki w pikselach
        line_width (int): Grubość linii obramowania
        cell_padding (int): Padding wewnątrz komórek
        left_margin (int): Margines lewy obrazu
    """
    
    def __init__(self, font_size=None, line_width=None):
        """
        Inicjalizuje generator tabel.
        
        Args:
            font_size (int, optional): Rozmiar czcionki. Domyślnie z config.
            line_width (int, optional): Grubość linii. Domyślnie z config.
        """
        self.font_size = font_size or DEFAULTS["font_size"]
        self.line_width = line_width or DEFAULTS["line_width"]
        self.cell_padding = DEFAULTS["cell_padding"]
        self.left_margin = DEFAULTS["left_margin"]
        
    def load_font(self):
        """
        Ładuje czcionkę TrueType lub domyślną.
        
        Returns:
            ImageFont: Załadowana czcionka
        """
        if os.path.exists(DEFAULT_FONT_PATH):
            try:
                return ImageFont.truetype(DEFAULT_FONT_PATH, self.font_size)
            except Exception as e:
                print(f"⚠️ Nie udało się załadować czcionki: {e}")
        
        print("ℹ️ Używam domyślnej czcionki")
        return ImageFont.load_default()
    
    def calculate_dimensions(self, texts, font):
        """
        Oblicza wymiary komórek na podstawie tekstów.
        
        Args:
            texts (list): Lista tekstów do wyświetlenia
            font (ImageFont): Czcionka do pomiaru
            
        Returns:
            tuple: (szerokość_komórki, wysokość_komórki)
        """
        max_width = 0
        max_height = 0
        
        for text in texts:
            bbox = font.getbbox(text)
            width = bbox[2] - bbox[0]
            height = bbox[3] - bbox[1]
            max_width = max(max_width, width)
            max_height = max(max_height, height)
        
        cell_height = max_height + (2 * self.cell_padding)
        cell_width = max_width + (2 * self.cell_padding)
        
        return cell_width, cell_height
    
    def generate(self, texts, logo_path):
        """
        Generuje obraz tabeli z logo.
        
        Args:
            texts (list): Lista tekstów dla wierszy tabeli
            logo_path (str): Ścieżka do pliku logo
            
        Returns:
            PIL.Image: Wygenerowany obraz
            
        Raises:
            FileNotFoundError: Jeśli logo nie istnieje
            ValueError: Jeśli lista tekstów jest pusta
        """
        if not texts:
            raise ValueError("Lista tekstów nie może być pusta")
        
        if not os.path.exists(logo_path):
            raise FileNotFoundError(f"Logo nie znalezione: {logo_path}")
        
        # Przygotuj czcionkę i wymiary
        font = self.load_font()
        cell_width, cell_height = self.calculate_dimensions(texts, font)
        table_height = cell_height * len(texts)
        
        # Wczytaj i przeskaluj logo
        logo = self._prepare_logo(logo_path, table_height)
        
        # Oblicz wymiary całkowite
        total_width = (self.left_margin + logo.width + cell_width + 
                      self.left_margin + 3 * self.line_width)
        total_height = max(table_height + 2 * self.left_margin, 
                          logo.height + 2 * self.left_margin)
        
        # Utwórz obraz
        image = Image.new("RGB", (total_width, total_height), (255, 255, 255))
        draw = ImageDraw.Draw(image)
        
        # Oblicz pozycję logo
        logo_y = (total_height - logo.height) // 2
        logo_x = self.left_margin + self.line_width
        
        # Wklej logo
        image.paste(logo, (logo_x, logo_y), logo)
        
        # Rysuj tabelę
        self._draw_table(
            draw, texts, font, logo_x, logo.width, 
            cell_width, cell_height, total_height
        )
        
        return image
    
    def _prepare_logo(self, logo_path, desired_height):
        """
        Przygotowuje logo (wczytuje i skaluje).
        
        Args:
            logo_path (str): Ścieżka do logo
            desired_height (int): Docelowa wysokość logo
            
        Returns:
            PIL.Image: Przeskalowane logo z kanałem alpha
        """
        logo = Image.open(logo_path)
        
        # Konwertuj do RGBA jeśli potrzeba
        if logo.mode != 'RGBA':
            logo = logo.convert('RGBA')
        
        # Oblicz wymiary zachowując proporcje
        desired_height = desired_height - 2 * self.line_width
        aspect_ratio = logo.height / logo.width
        desired_width = int(desired_height / aspect_ratio)
        
        # Przeskaluj
        return logo.resize(
            (desired_width + 1, desired_height + 1), 
            Image.Resampling.LANCZOS
        )
    
    def _draw_table(self, draw, texts, font, logo_x, logo_width, 
                   cell_width, cell_height, total_height):
        """
        Rysuje tabelę z tekstami na obrazie.
        
        Args:
            draw (ImageDraw): Obiekt do rysowania
            texts (list): Lista tekstów
            font (ImageFont): Czcionka
            logo_x (int): Pozycja X logo
            logo_width (int): Szerokość logo
            cell_width (int): Szerokość komórki
            cell_height (int): Wysokość komórki
            total_height (int): Całkowita wysokość obrazu
        """
        table_height = cell_height * len(texts)
        start_x = logo_x + logo_width + self.line_width
        start_y = (total_height - table_height) // 2
        
        # Obramowanie całości
        frame_x = logo_x - self.line_width
        draw.rectangle(
            [
                (frame_x - self.line_width, start_y - self.line_width),
                (frame_x + logo_width + cell_width + 3 * self.line_width,
                 start_y + table_height + self.line_width)
            ],
            outline=(0, 0, 0),
            width=self.line_width
        )
        
        # Obramowanie logo
        draw.rectangle(
            [
                (frame_x, start_y),
                (frame_x + logo_width + 2 * self.line_width, 
                 start_y + table_height)
            ],
            outline=(0, 0, 0),
            width=self.line_width
        )
        
        # Rysuj komórki z tekstem
        for i, text in enumerate(texts):
            self._draw_cell(
                draw, text, font, start_x, start_y, 
                cell_width, cell_height, i
            )
    
    def _draw_cell(self, draw, text, font, start_x, start_y, 
                   cell_width, cell_height, index):
        """
        Rysuje pojedynczą komórkę z tekstem.
        
        Args:
            draw (ImageDraw): Obiekt do rysowania
            text (str): Tekst do wyświetlenia
            font (ImageFont): Czcionka
            start_x (int): Początkowa pozycja X tabeli
            start_y (int): Początkowa pozycja Y tabeli
            cell_width (int): Szerokość komórki
            cell_height (int): Wysokość komórki
            index (int): Indeks wiersza
        """
        # Pozycja komórki
        y1 = start_y + index * cell_height
        y2 = y1 + cell_height
        x1 = start_x
        x2 = x1 + cell_width
        
        # Rysuj obramowanie komórki
        draw.rectangle(
            [(x1, y1), (x2, y2)],
            outline=(0, 0, 0),
            width=self.line_width
        )
        
        # Oblicz pozycję tekstu (wyśrodkowanie pionowe)
        bbox = font.getbbox(text)
        text_height = bbox[3] - bbox[1]
        
        text_x = x1 + self.cell_padding
        text_y = y1 + (cell_height - text_height) // 2 - 3 * self.line_width
        
        # Rysuj tekst
        draw.text((text_x, text_y), text, fill=(0, 0, 0), font=font)


# === FUNKCJE POMOCNICZE ===

def create_preview(image, max_width=600):
    """
    Tworzy pomniejszoną wersję obrazu do podglądu.
    
    Args:
        image (PIL.Image): Oryginalny obraz
        max_width (int): Maksymalna szerokość podglądu
        
    Returns:
        PIL.Image: Przeskalowany obraz
    """
    width, height = image.size
    preview_height = int(height * (max_width / width))
    
    return image.resize(
        (max_width, preview_height), 
        Image.Resampling.LANCZOS
    )


def validate_inputs(texts, logo_path):
    """
    Waliduje dane wejściowe przed generowaniem.
    
    Args:
        texts (list): Lista tekstów
        logo_path (str): Ścieżka do logo
        
    Returns:
        tuple: (is_valid, error_message)
    """
    if not texts:
        return False, "Lista tekstów jest pusta"
    
    if not logo_path:
        return False, "Nie wybrano logo"
    
    if not os.path.exists(logo_path):
        return False, f"Logo nie istnieje: {logo_path}"
    
    return True, None
