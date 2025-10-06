import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from PIL import Image
import zipfile
import io
import os

class AdvancedIconGeneratorApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Gelişmiş İkon Oluşturucu")
        self.root.geometry("500x450")
        self.root.resizable(False, False)
        
        # Stil ayarları
        style = ttk.Style()
        style.configure("TButton", padding=6, relief="flat", background="#cceeff")
        style.configure("TLabel", padding=5)
        style.configure("Header.TLabel", font=("Helvetica", 16, "bold"))
        style.configure("Status.TLabel", font=("Helvetica", 9))

        self.file_path = None
        self.image_name = None
        
        # Seçilebilecek ikon boyutları listesi
        self.available_sizes = [16, 24, 32, 48, 64, 72, 96, 128, 192, 256, 512]
        self.size_vars = {} # Boyutların yanındaki checkbox'ların durumunu tutar

        self.create_widgets()

    def create_widgets(self):
        """Uygulamanın arayüz elemanlarını oluşturur."""
        
        main_frame = ttk.Frame(self.root, padding="10 10 10 10")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # 1. Adım: Dosya Yükleme
        upload_frame = ttk.LabelFrame(main_frame, text="1. Adım: Görsel Seçimi", padding="10")
        upload_frame.pack(fill=tk.X, pady=5)
        
        self.upload_button = ttk.Button(upload_frame, text="Görsel Yükle", command=self.load_image)
        self.upload_button.pack(side=tk.LEFT, padx=(0, 10))

        self.file_label = ttk.Label(upload_frame, text="Henüz bir görsel seçilmedi.", style="Status.TLabel", foreground="gray")
        self.file_label.pack(side=tk.LEFT)

        # 2. Adım: Boyut Seçimi
        sizes_frame = ttk.LabelFrame(main_frame, text="2. Adım: İkon Boyutlarını Seç", padding="10")
        sizes_frame.pack(fill=tk.X, pady=10)

        # Checkbox'ları 4 sütunlu bir grid'e yerleştir
        num_columns = 4
        for i, size in enumerate(self.available_sizes):
            var = tk.IntVar(value=1 if size in [16, 32, 64, 128, 256] else 0) # Bazıları varsayılan seçili olsun
            self.size_vars[size] = var
            cb = ttk.Checkbutton(sizes_frame, text=f"{size}x{size}", variable=var)
            cb.grid(row=i // num_columns, column=i % num_columns, sticky=tk.W, padx=5, pady=2)
            
        toggle_button = ttk.Button(sizes_frame, text="Tümünü Seç / Bırak", command=self.toggle_all_sizes)
        toggle_button.grid(row=(len(self.available_sizes) // num_columns) + 1, column=0, columnspan=num_columns, pady=(10, 0))


        # 3. Adım: Dosya Adı
        filename_frame = ttk.LabelFrame(main_frame, text="3. Adım: Kaydedilecek Dosya Adı", padding="10")
        filename_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(filename_frame, text="ZIP Dosya Adı:").pack(side=tk.LEFT, padx=(0, 5))
        self.zip_name_var = tk.StringVar()
        self.zip_name_entry = ttk.Entry(filename_frame, textvariable=self.zip_name_var, width=40)
        self.zip_name_entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
        ttk.Label(filename_frame, text=".zip").pack(side=tk.LEFT)

        # 4. Adım: Oluşturma
        self.generate_button = ttk.Button(main_frame, text="İkonları Oluştur ve Kaydet", command=self.generate_and_save_icons, state=tk.DISABLED)
        self.generate_button.pack(pady=20, ipady=10)

    def load_image(self):
        """Kullanıcının bir görsel dosyası seçmesini sağlar."""
        file_path = filedialog.askopenfilename(
            title="Bir Görsel Seçin",
            filetypes=[("Görsel Dosyaları", "*.png *.jpg *.jpeg *.bmp"), ("Tüm Dosyalar", "*.*")]
        )
        if file_path:
            self.file_path = file_path
            self.image_name = os.path.splitext(os.path.basename(self.file_path))[0]
            self.file_label.config(text=f"Seçildi: {os.path.basename(self.file_path)}", foreground="black")
            self.generate_button.config(state=tk.NORMAL)
            # Varsayılan dosya adını ayarla
            self.zip_name_var.set(f"{self.image_name}_ikonlar")

    def toggle_all_sizes(self):
        """Tüm boyut checkbox'larının durumunu tersine çevirir."""
        # Eğer hepsi seçiliyse, hepsini bırak. Değilse, hepsini seç.
        current_values = [var.get() for var in self.size_vars.values()]
        new_value = 0 if all(current_values) else 1
        for var in self.size_vars.values():
            var.set(new_value)

    def generate_and_save_icons(self):
        """Görseli seçilen boyutlara göre yeniden boyutlandırır ve ZIP olarak kaydeder."""
        selected_sizes = [size for size, var in self.size_vars.items() if var.get() == 1]
        
        if not self.file_path:
            messagebox.showwarning("Hata", "Lütfen önce bir görsel yükleyin.")
            return
        if not selected_sizes:
            messagebox.showwarning("Hata", "Lütfen en az bir ikon boyutu seçin.")
            return
        
        zip_base_name = self.zip_name_var.get().strip()
        if not zip_base_name:
            messagebox.showwarning("Hata", "Lütfen ZIP dosyası için bir ad belirtin.")
            return
        
        # Dosya kaydetme diyaloğu için başlangıç adını oluştur
        initial_zip_filename = f"{zip_base_name}.zip"

        save_path = filedialog.asksaveasfilename(
            title="ZIP Dosyasını Kaydet",
            initialfile=initial_zip_filename,
            defaultextension=".zip",
            filetypes=[("ZIP dosyası", "*.zip")]
        )

        if not save_path:
            return

        try:
            with Image.open(self.file_path) as img:
                resample_filter = Image.Resampling.LANCZOS # Yüksek kaliteli küçültme
                img = img.convert("RGBA") # PNG için şeffaflığı koru

                with zipfile.ZipFile(save_path, 'w') as zipf:
                    for size in selected_sizes:
                        resized_img = img.resize((size, size), resample_filter)
                        
                        byte_arr = io.BytesIO()
                        resized_img.save(byte_arr, format='PNG')
                        byte_arr.seek(0)
                        
                        # ZIP içindeki dosya adını metin kutusundaki değere göre oluştur
                        file_name_in_zip = f"{zip_base_name}_{size}x{size}.png"
                        zipf.writestr(file_name_in_zip, byte_arr.read())

            messagebox.showinfo("Başarılı", f"İkonlar başarıyla oluşturuldu ve '{os.path.basename(save_path)}' olarak kaydedildi.")
        except Exception as e:
            messagebox.showerror("Hata", f"Bir hata oluştu: {e}")

if __name__ == "__main__":
    root = tk.Tk()
    app = AdvancedIconGeneratorApp(root)
    root.mainloop()

