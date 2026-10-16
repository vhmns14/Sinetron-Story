// Sinetron / FTV title generator. Handwritten pools + slot templates with grammatical fill-ins,
// so results read like real Indonesian TV titles (sinetron stripping, Indosiar azab/suara hati, FTV siang).
// All titles here are original; none is meant to copy an existing show verbatim.

type Rnd = () => number;
const pick = <T,>(a: readonly T[], r: Rnd): T => a[Math.floor(r() * a.length)];

// ------------------------------------------------------------------ theme vocab
// m / f: lead characters (adult unless the theme is about teens), head-first noun phrases that work after
//        "Jatuh Cinta Sama ...", "Pacarku ...", "Jodohku Ternyata ...".
// ma / fa: adult-only versions for husband/wife templates (fallback m / f).
// bad: sinners for azab titles ("Azab ..."). elder: parent figures ("Air Mata ...").
// place: "di ..." phrases. spot: creepy/specific spots ("Penunggu ..."). turf: an area someone can rule ("Jagoan ...").
// (turf is empty where 'Jagoan X' would sound wrong; templates needing it are skipped there)
// item: everyday objects of the setting ("Gara-Gara ..."). fate: setting-specific azab endings (with -nya).
interface Vocab {
  m: string[]; f: string[]; ma?: string[]; fa?: string[];
  bad: string[]; elder: string[]; place: string[]; spot: string[]; turf: string[]; item: string[];
  fate?: string[];
}

export const VOCAB: Record<string, Vocab> = {
  kampung: {
    m: ['Pemuda Desa', 'Anak Pak Lurah', 'Tukang Ojek Pangkalan', 'Kang Cilok', 'Petani Muda', 'Anak Juragan Kambing', 'Tukang Sayur Keliling'],
    f: ['Kembang Desa', 'Anak Juragan Empang', 'Janda Kembang', 'Gadis Penjual Jamu', 'Anak Pak Kades', 'Neng Penjaga Warung'],
    bad: ['Rentenir Kampung', 'Kades yang Makan Dana Desa', 'Juragan Tanah Serakah', 'Tukang Gosip Kampung', 'Anak yang Menjual Sawah Ibunya', 'Menantu yang Mengusir Mertua'],
    elder: ['Emak', 'Bapak', 'Mbah Putri', 'Abah'],
    place: ['di Ujung Desa', 'di Pinggir Sawah', 'di Kampung Sebelah', 'di Balik Pos Ronda'],
    spot: ['Sumur Tua', 'Pos Ronda', 'Jembatan Kali', 'Kebun Bambu', 'Rumah Kosong Ujung Gang'],
    turf: ['Kampung Rawa', 'Desa Sukamaju', 'Kampung Kali Item'],
    item: ['Sepeda Ontel', 'Kambing Kurban', 'Kentongan', 'Sertifikat Sawah', 'Radio Butut'],
    fate: ['Jenazahnya Tenggelam di Lumpur Sawah', 'Kuburannya Dikerubuti Lintah', 'Kerandanya Tak Bisa Melewati Jembatan'],
  },
  kota: {
    m: ['Kurir Paket', 'Driver Ojol', 'Anak Konglomerat', 'Barista Ganteng', 'Satpam Apartemen', 'Pengusaha Muda'],
    f: ['Selebgram', 'Kasir Minimarket', 'Anak Pejabat', 'Mbak SPG Mall', 'Wanita Karier', 'Penjual Kopi Keliling'],
    bad: ['Pejabat Korup', 'Bos Pinjol', 'Pengusaha yang Menggusur Kampung', 'Istri Simpanan Pejabat', 'Anak Sultan Sombong', 'Selebgram Penipu Arisan'],
    elder: ['Mama', 'Papa', 'Ibu', 'Ayah'],
    place: ['di Ibu Kota', 'di Kolong Jembatan', 'di Lantai 30', 'di Gang Sempit Jakarta'],
    spot: ['Apartemen Lantai 13', 'Parkiran Basement', 'Lift Mati', 'Gedung Tua Kota', 'Halte Terakhir'],
    turf: ['Ibu Kota', 'Terminal Kota', 'Gang Kelinci', 'Jalanan Jakarta'],
    item: ['Ponsel Pintar', 'Mobil Mewah', 'Kartu Kredit', 'Helm Ojol', 'Akun Instagram'],
    fate: ['Jenazahnya Terjebak Macet Tujuh Hari', 'Mobil Jenazahnya Disambar Petir di Jalan Tol', 'Kuburannya Tergusur Proyek Jalan'],
  },
  sekolah: {
    m: ['Ketua OSIS', 'Kakak Kelas', 'Anak Baru', 'Kapten Basket', 'Cowok Paling Bandel', 'Anak Pindahan'],
    f: ['Ketua Kelas', 'Anak OSIS', 'Murid Baru', 'Kakak Kelas Galak', 'Cewek Kutu Buku', 'Primadona Sekolah'],
    ma: ['Guru Olahraga', 'Penjaga Sekolah', 'Guru Honorer'], fa: ['Guru BK', 'Ibu Kantin', 'Guru Honorer'],
    bad: ['Kepala Sekolah Korup', 'Guru yang Suka Pilih Kasih', 'Murid yang Durhaka pada Gurunya', 'Pelaku Bully'],
    elder: ['Ibu', 'Bapak', 'Mama', 'Ayah'],
    place: ['di Kantin Sekolah', 'di Ruang BK', 'di Kelas Sebelah', 'di Belakang Sekolah', 'di Perpustakaan'],
    spot: ['Toilet Sekolah', 'Ruang Musik', 'Gudang Belakang Sekolah', 'Lab Biologi', 'Kelas XII IPA 3'],
    turf: ['SMA Pelita', 'SMA Harapan Bangsa', 'Sekolah Pinggiran'],
    item: ['Surat Cinta', 'Buku Diary', 'Seragam Pinjaman', 'Kartu Ujian', 'Kaos Olahraga'],
  },
  pasar: {
    m: ['Tukang Sayur', 'Pedagang Cilok', 'Kuli Panggul', 'Tukang Parkir Pasar', 'Anak Juragan Beras', 'Tukang Daging'],
    f: ['Penjual Jamu', 'Anak Juragan Empang', 'Gadis Penjual Kue', 'Pedagang Ikan', 'Janda Pemilik Warung', 'Mbak Penjual Gorengan'],
    bad: ['Rentenir Pasar', 'Juragan Beras yang Pelit', 'Preman Pasar', 'Pedagang yang Mengurangi Timbangan', 'Tukang Fitnah Pasar', 'Penagih Utang Keliling'],
    elder: ['Emak', 'Bapak', 'Mak', 'Abah'],
    place: ['di Pasar Subuh', 'di Lapak Paling Ujung', 'di Pasar Kaget', 'di Los Ikan'],
    spot: ['Gudang Beras', 'Los Daging', 'Pasar Malam', 'Lapak Kosong Nomor 13', 'Toilet Pasar'],
    turf: ['Pasar Induk', 'Pasar Subuh', 'Pasar Senggol'],
    item: ['Timbangan', 'Gerobak Cilok', 'Karung Beras', 'Bakul Jamu', 'Uang Receh'],
    fate: ['Jenazahnya Tertimbun Karung Beras', 'Timbangannya Ikut Masuk Liang Lahat', 'Kuburannya Dikerubuti Lalat Pasar'],
  },
  pesantren: {
    m: ['Santri', 'Gus Muda', 'Ustaz Muda', 'Santri Bandel', 'Anak Kiai', 'Hafiz Muda'],
    f: ['Santriwati', 'Ning Pesantren', 'Ustazah Muda', 'Putri Kiai', 'Santri Baru', 'Hafizah Cantik'],
    fa: ['Ustazah Muda', 'Ning Pesantren', 'Janda Muda Tetangga Pondok'],
    bad: ['Pengurus yang Menilap Uang Pondok', 'Penipu Berkedok Ustaz', 'Anak yang Durhaka pada Kiai', 'Rentenir yang Menyita Tanah Wakaf'],
    elder: ['Abah Kiai', 'Umi', 'Bu Nyai', 'Abah'],
    place: ['di Pesantren', 'di Serambi Masjid', 'di Asrama Putri', 'di Pondok'],
    spot: ['Asrama Kosong', 'Kamar Mandi Pondok', 'Kolam Wudu', 'Makam Belakang Pondok'],
    turf: [],
    item: ['Kitab Kuning', 'Sarung Pinjaman', 'Peci Hitam', 'Tasbih Kayu', 'Sajadah Lusuh'],
    fate: ['Jenazahnya Tak Bisa Dimandikan', 'Kuburannya Bergetar Setiap Azan'],
  },
  kantor: {
    m: ['Bos Muda', 'OB Kantor', 'Satpam Kantor', 'CEO Dingin', 'Karyawan Magang', 'Supir Direktur'],
    f: ['Sekretaris Baru', 'Resepsionis', 'Anak Magang', 'Bos Galak', 'Karyawati Teladan', 'OG Kantor'],
    bad: ['Bos Pelit', 'Manajer Penjilat', 'Atasan Korup', 'Karyawan Tukang Fitnah', 'Direktur yang Menipu Karyawannya'],
    elder: ['Ibu', 'Bapak', 'Mama', 'Papa'],
    place: ['di Kantor', 'di Ruang Rapat', 'di Pantry Kantor', 'di Lantai Direksi'],
    spot: ['Lift Kantor', 'Ruang Arsip', 'Toilet Lantai 7', 'Gudang Kantor', 'Basement Kantor'],
    turf: [],
    item: ['Absen Sidik Jari', 'Surat Resign', 'Kopi Pagi', 'Slip Gaji', 'Kartu Akses'],
    fate: ['Jenazahnya Tertahan di Lift Kantor', 'Kuburannya Tertimbun Tumpukan Berkas'],
  },
  rumahsakit: {
    m: ['Dokter Muda', 'Perawat', 'Dokter Jaga', 'Supir Ambulans', 'Pasien Kamar 7', 'Dokter Bedah'],
    f: ['Suster', 'Dokter Muda', 'Bidan Desa', 'Perawat Baru', 'Pasien Cantik', 'Dokter Koas'],
    bad: ['Dokter Mata Duitan', 'Mafia Obat', 'Anak yang Membuang Ibunya di Rumah Sakit', 'Penipu Asuransi'],
    elder: ['Ibu', 'Bapak', 'Mama', 'Ayah'],
    place: ['di Rumah Sakit', 'di Ruang UGD', 'di Bangsal Mawar', 'di Lorong Rumah Sakit'],
    spot: ['Kamar Mayat', 'Bangsal Lama', 'Ruang Operasi', 'Lorong Lantai 4', 'Kamar 207'],
    turf: [],
    item: ['Kursi Roda', 'Infus', 'Resep Dokter', 'Hasil Lab', 'Gelang Pasien'],
    fate: ['Jenazahnya Hilang dari Kamar Mayat', 'Ambulansnya Mogok di Depan Rumah Janda'],
  },
  kos: {
    m: ['Anak Kos', 'Penghuni Kamar 13', 'Mas Burjo', 'Anak Kos Perantau', 'Penghuni Baru', 'Mahasiswa Rantau'],
    f: ['Anak Ibu Kos', 'Penghuni Kamar Sebelah', 'Anak Kos Cantik', 'Mbak Laundry', 'Penghuni Baru', 'Gadis Perantau'],
    bad: ['Ibu Kos Pelit', 'Penghuni yang Kabur Bawa Uang Arisan', 'Juragan Kos Lintah Darat', 'Maling Jemuran'],
    elder: ['Emak', 'Ibu', 'Bapak', 'Abah'],
    place: ['di Kos-kosan', 'di Kamar Sebelah', 'di Kos Putri', 'di Lantai Dua'],
    spot: ['Kamar 13', 'Jemuran Lantai Atas', 'Kamar Mandi Kos', 'Kos Kosong Ujung Gang', 'Dapur Bersama'],
    turf: [],
    item: ['Mi Instan', 'Kipas Angin', 'Rice Cooker', 'Jemuran', 'Uang Kos'],
    fate: ['Jenazahnya Terkunci di Kamar Kos', 'Kuburannya Ditagih Uang Sewa'],
  },
  kampus: {
    m: ['Asdos Ganteng', 'Ketua BEM', 'Mahasiswa Abadi', 'Dosen Muda', 'Anak Teknik', 'Mahasiswa Rantau'],
    f: ['Mahasiswi Baru', 'Anak Kedokteran', 'Asdos Galak', 'Ketua Himpunan', 'Mahasiswi Perantau', 'Dosen Killer'],
    bad: ['Dosen yang Menjual Nilai', 'Mahasiswa Joki Skripsi', 'Rektor Korup', 'Penipu Beasiswa'],
    elder: ['Ibu', 'Bapak', 'Emak', 'Ayah'],
    place: ['di Kampus', 'di Perpustakaan Kampus', 'di Kantin Fakultas', 'di Semester Akhir'],
    spot: ['Gedung Fakultas Lama', 'Lab Komputer', 'Toilet Gedung C', 'Perpustakaan Malam'],
    turf: [],
    item: ['Skripsi', 'Jas Almamater', 'Kartu Mahasiswa', 'Proposal Penelitian', 'Laptop Pinjaman'],
  },
  hutan: {
    m: ['Pemburu', 'Penjaga Hutan', 'Pendaki Gunung', 'Penebang Kayu', 'Pemuda Pencari Rotan', 'Juru Kunci'],
    f: ['Gadis Penjaga Hutan', 'Pendaki Wanita', 'Putri Penunggu Gunung', 'Gadis Pencari Kayu Bakar', 'Anak Juru Kunci'],
    bad: ['Pembalak Liar', 'Pemburu Serakah', 'Dukun Pesugihan', 'Juragan Kayu yang Membakar Hutan'],
    elder: ['Emak', 'Bapak', 'Mbah', 'Abah'],
    place: ['di Tengah Hutan', 'di Lereng Gunung', 'di Hutan Larangan', 'di Kaki Gunung'],
    spot: ['Pohon Beringin', 'Goa Larangan', 'Hutan Larangan', 'Air Terjun Keramat', 'Pos Pendakian Tiga'],
    turf: ['Hutan Larangan', 'Gunung Kidul', 'Lembah Hitam'],
    item: ['Kapak', 'Peta Kuno', 'Kalung Bertuah', 'Senter Mati', 'Batu Akik'],
    fate: ['Jenazahnya Dililit Akar Beringin', 'Kuburannya Ditumbuhi Pohon Berduri'],
  },
  kerajaan: {
    m: ['Pangeran', 'Prajurit Keraton', 'Patih', 'Abdi Dalem', 'Putra Mahkota', 'Pendekar Pengawal'],
    f: ['Putri Keraton', 'Dayang Istana', 'Permaisuri', 'Putri Selir', 'Gadis Penari Istana', 'Ratu Muda'],
    bad: ['Patih yang Berkhianat', 'Raja Lalim', 'Selir yang Meracuni Permaisuri', 'Adipati Serakah'],
    elder: ['Ibunda Ratu', 'Ayahanda Prabu', 'Kanjeng Ibu', 'Eyang Prabu'],
    place: ['di Keraton', 'di Balik Tembok Istana', 'di Taman Sari', 'di Pendapa Agung'],
    spot: ['Sumur Keraton', 'Penjara Bawah Tanah', 'Pendapa Tua', 'Makam Raja-Raja', 'Kamar Pusaka'],
    turf: ['Kerajaan Majaraya', 'Keraton Selatan', 'Negeri Seberang', 'Tanah Jawa'],
    item: ['Keris Pusaka', 'Mahkota Emas', 'Selendang Sutra', 'Cincin Kerajaan', 'Gamelan Pusaka'],
    fate: ['Jenazahnya Ditolak Liang Lahat Leluhur', 'Mahkotanya Terbakar Bersama Istananya'],
  },
  laut: {
    m: ['Nelayan Muda', 'Anak Nelayan', 'Penjaga Mercusuar', 'Penyelam Mutiara', 'Juragan Kapal', 'Tukang Perahu'],
    f: ['Gadis Pantai', 'Anak Juragan Kapal', 'Penjual Ikan Asin', 'Penari Pantai', 'Putri Laut', 'Gadis Penjual Kerang'],
    bad: ['Juragan Kapal Serakah', 'Tengkulak Ikan', 'Pengebom Ikan', 'Rentenir Nelayan'],
    elder: ['Emak', 'Bapak', 'Mbah', 'Abah'],
    place: ['di Pantai Selatan', 'di Tengah Laut', 'di Dermaga Tua', 'di Kampung Nelayan'],
    spot: ['Mercusuar Tua', 'Dermaga Tua', 'Karang Bolong', 'Goa Pantai', 'Kamar 308'],
    turf: ['Pantai Selatan', 'Teluk Biru', 'Kampung Nelayan'],
    item: ['Jala Ikan', 'Perahu Tua', 'Kerang Ajaib', 'Selendang Hijau', 'Mutiara Hitam'],
    fate: ['Jenazahnya Diseret Ombak Kembali ke Pantai', 'Perahunya Karam Membawa Keranda'],
  },
};

// generic azab endings (all with -nya)
const FATE = [
  'Jenazahnya Ditolak Bumi', 'Liang Lahatnya Terus Menyempit', 'Jenazahnya Mengeluarkan Bau Busuk',
  'Mobil Jenazahnya Mogok di Tanjakan', 'Kuburannya Dipenuhi Air Comberan', 'Jenazahnya Tertimpa Pohon Kelapa',
  'Kerandanya Tak Bisa Diangkat', 'Tubuhnya Membengkak Sebelum Dikubur', 'Jenazahnya Disambar Petir Saat Dimakamkan',
  'Kuburannya Amblas Setelah Tujuh Hari', 'Wajahnya Menghitam Saat Dimandikan', 'Hartanya Habis Dalam Semalam',
];
const GHOST = ['Kuntilanak', 'Pocong', 'Genderuwo', 'Sundel Bolong', 'Wewe Gombel', 'Tuyul', 'Hantu Noni Belanda'];
const ANIMAL = ['Ular', 'Harimau', 'Buaya Putih', 'Kera', 'Kucing Hitam', 'Burung Gagak', 'Ular Naga'];

// ------------------------------------------------------------------ handwritten whole titles per genre (theme-free)
export const WHOLE: Record<string, string[]> = {
  romansa: [
    'Ikatan Janji Suci', 'Cinta Tak Pernah Salah Alamat', 'Kau Masih Kekasihku', 'Cinta Datang Terlambat', 'Hati yang Terbelah Dua',
    'Mendadak Nikah Sama Tetangga', 'Jodoh Pilihan Ibu', 'Cintaku Nyangkut di Kamu', 'Setulus Hati Aisyah', 'Dua Hati Satu Payung',
    'Cincin yang Tertukar', 'Pengantin Cadangan', 'Asmara di Bawah Hujan', 'Kekasih Kontrak', 'Rindu Tak Bertuan',
    'Menikah Diam-Diam', 'Cinta Sebening Embun', 'Yang Tersisa dari Senja', 'Bulan di Ujung Jari', 'Takdir Mempertemukan Kita',
    'Sepotong Hati untuk Ayu', 'Karena Cinta Tak Pernah Pergi', 'Cinta Beda Kasta', 'Dijodohkan Sejak Lahir', 'Kamu Bukan Pelarian',
    'Berbagi Cinta di Hari Raya', 'Cinta Pertama Tak Pernah Mati', 'Nikah Kontrak Setahun',
  ],
  komedi: [
    'Keluarga Super Rempong', 'Tetangga Rese Banget', 'Bapak-Bapak Komplek', 'Juragan Pete Cari Mantu', 'Mertua Rasa Satpam',
    'Emak-Emak Ngegas', 'Arisan Bikin Pusing', 'Rumah Kontrakan Tiga Petak', 'Bujang Lapuk Cari Jodoh', 'Pak RT Kena Mental',
    'Dompet Tipis, Gaya Selangit', 'Salah Sambung Tiap Hari', 'Ojek Pangkalan Gaul', 'Gengsi Dong, Cuy!', 'Kawin Lari Tapi Capek',
    'Juragan Kontrakan Super Pelit', 'Duda Keren Satu Gang', 'Kampung Sinyal Lemot', 'Hansip Siaga Satu', 'Bang Kumis Pulang Kampung',
    'Kakek Gaul Masuk TikTok', 'Warung Kopi Mang Ujang', 'Nyai Ronda', 'Bajaj Biru Bang Somad', 'Tukang Bakso Mendadak Artis',
    'Bapak Ketiban Arisan', 'Hidup Pas-Pasan, Banyolan Melimpah',
  ],
  keluarga: [
    'Air Mata Seorang Ibu', 'Anak-Anak Bapak', 'Rumah Penuh Doa', 'Ibu, Aku Pulang', 'Kakak untuk Adik',
    'Satu Atap Dua Menantu', 'Mertua Bukan Musuh', 'Ayah Tak Pernah Mengeluh', 'Pintu Rumah Selalu Terbuka', 'Warisan Bapak',
    'Lima Saudara', 'Pelangi di Rumah Kecil', 'Ibu Tiri Berhati Emas', 'Anakku Bukan Anakmu', 'Rahasia di Meja Makan',
    'Ketika Suami Diam', 'Bapak Sopir Angkot', 'Istri Kedua Ayah', 'Di Rumah Nenek', 'Pulang Sebelum Lebaran',
    'Tangisan Anak Bungsu', 'Kursi Kosong di Ruang Tamu', 'Mertua Datang Membawa Koper', 'Menantu Kesayangan Ibu',
    'Suara Hati Istri: Suamiku Diam-Diam Menikah Lagi', 'Suara Hati Anak: Ayah, Jangan Tinggalkan Ibu',
    'Suara Hati Istri: Mertuaku Memilih Mantan Suamiku', 'Kisah Pilu Ibu: Anakku Malu Mengakuiku',
  ],
  azab: [
    'Azab Suami Durhaka, Jenazahnya Ditolak Bumi', 'Azab Istri Pembangkang, Kuburannya Penuh Belatung', 'Azab Anak Durhaka, Tubuhnya Membatu di Depan Ibunya',
    'Azab Rentenir Kejam, Mobil Jenazahnya Masuk Jurang', 'Azab Tukang Fitnah, Lidahnya Menjulur Sampai Liang Lahat', 'Azab Mertua Zalim, Jenazahnya Tak Muat di Keranda',
    'Azab Juragan Pelit, Hartanya Ikut Terkubur', 'Azab Tukang Riba, Kuburannya Dikepung Lintah', 'Azab Pemakan Harta Anak Yatim',
    'Azab Suami yang Menelantarkan Istri Sakit', 'Azab Tukang Pamer, Jenazahnya Terseret Banjir', 'Azab Pengkhianat Sahabat, Liang Lahatnya Mengeluarkan Asap',
    'Kisah Nyata: Jenazah Lintah Darat Tertimpa Pohon Nangka', 'Akhir Hidup Si Tukang Sumpah Palsu', 'Detik-Detik Terakhir Suami yang Gemar Berjudi',
    'Azab Menantu yang Menyiksa Mertua, Tubuhnya Membusuk Sebelum Dikubur', 'Azab Istri yang Menghina Suami Miskin', 'Azab Kakak Serakah Rebut Warisan Adik',
    'Azab Pelakor, Kuburannya Diserbu Tawon', 'Azab Pemungut Pajak Liar', 'Suara Hati Istri: Suamiku Pulang Bawa Madu',
    'Azab Orang Kaya yang Mengusir Pengemis', 'Azab Tukang Ghibah Satu RT', 'Azab Ayah yang Menjual Anaknya', 'Azab Lintah Darat, Jenazahnya Dikerubuti Tikus',
    'Azab Pencuri Kotak Amal, Kakinya Tak Bisa Berhenti Berlari',
  ],
  religi: [
    'Hidayah di Sepertiga Malam', 'Tasbih Peninggalan Ayah', 'Pintu Taubat Masih Terbuka', 'Sujud di Ujung Sajadah', 'Sajadah Merah Ibu',
    'Di Bawah Langit Ramadan', 'Kubah Hijau di Ujung Jalan', 'Mukena untuk Ibu', 'Air Mata Taubat Pak Kades', 'Jalan Pulang Menuju-Mu',
    'Istikharah Tiga Malam', 'Surat untuk Ummi', 'Hijrah Itu Tidak Mudah', 'Doa yang Tak Pernah Putus', 'Lentera Kecil di Surau',
    'Takbir Terakhir Bapak', 'Rezeki Tak Pernah Salah Alamat', 'Muazin Kampung', 'Panggilan dari Tanah Suci', 'Sedekah Subuh',
    'Kafan untuk Si Kaya', 'Cahaya di Wajah Ibu', 'Malaikat Kecil Penghafal Quran', 'Berkah Gerobak Sayur', 'Imam Muda dari Kampung Sebelah',
    'Selepas Isya', 'Kisah Hikmah: Tukang Becak yang Dirindukan Surga',
  ],
  remaja: [
    'Geng Motor Rawamangun', 'Cinta Masa SMA Gak Ada Obat', 'Diary Anak Baru Gede', 'Jangan Bilang-Bilang Mama', 'Ciee, Jadian',
    'Anak Band Paling Ngehits', 'Gue Bukan Cupu', 'Kapten Basket & Si Kutu Buku', 'Galau Sebelum Ujian', 'Kakak Kelas Rese',
    'Pacar Online', 'Sahabat Jadi Cinta, Eh Batal', 'Tujuh Hari Mengejar Kamu', 'Bolos Demi Cinta', 'Persahabatan Bagai Kepompong Retak',
    'Anak Senja', 'Dia Bukan Gebetanku', 'Squad Kantin', 'Motor Butut Cinta Mulus', 'Cinta Monyet Naik Kelas',
    'Gara-Gara Story', 'Mantan Rasa Sahabat', 'Kita Udahan Aja, Ya', 'Remaja Masjid Gaul', 'Kode Keras',
    'Jomblo Sampai Wisuda',
  ],
  horor: [
    'Kentongan Tengah Malam', 'Jangan Menoleh ke Belakang', 'Penghuni Rumah Kosong', 'Arwah Penasaran Bu Ningsih', 'Kuntilanak Ketawa Jam Tiga',
    'Pocong Minta Tolong', 'Tumbal Proyek Jembatan', 'Rumah Warisan Nenek', 'Ada yang Ikut Pulang', 'Teror Malam Jumat Kliwon',
    'Bisikan dari Loteng', 'Genderuwo Rebutan Bini', 'Keranda Jalan Sendiri', 'Panggil Aku Tiga Kali', 'Hantu Kamar Pengantin',
    'Siapa yang Mengetuk Pintu?', 'Sumur Belakang Rumah', 'Boneka Arwah', 'Santet Kiriman Mantan', 'Pesugihan Kandang Kambing',
    'Nenek Penjual Kembang Tengah Malam', 'Tembang Jawa Jam Dua Belas', 'Jeritan di Malam Pengantin', 'Kain Kafan Berdarah', 'Jangan Ambil Fotoku',
    'Hantu Tanpa Kepala dari Rel Kereta',
  ],
  laga: [
    'Jagoan Kampung Pulang', 'Si Kilat Tangan Besi', 'Pendekar Kujang Emas', 'Bang Jago Insaf', 'Elang Hitam dari Timur',
    'Pendekar Bertopeng Sarung', 'Tendangan Halilintar', 'Jawara Betawi Muda', 'Raja Jalanan', 'Duel di Atas Kereta',
    'Jurus Seribu Bayangan', 'Pendekar Golok Setan', 'Macan Tanah Abang Bangkit', 'Laskar Pemberani', 'Tukang Pukul Bertobat',
    'Anak Jalanan Berhati Baja', 'Utang Darah Dibayar Darah', 'Bayangan Merah dari Utara', 'Kapten Garuda', 'Pukulan Tujuh Langkah',
    'Polisi Kampung', 'Sabuk Hitam Tukang Bakso', 'Gerak Cepat Bang Jalu', 'Terminal Panas', 'Tinju Rajawali',
  ],
  siluman: [
    'Istriku Siluman Ular', 'Kutukan Ratu Ular', 'Mustika Naga Putih', 'Harimau Jadi-Jadian', 'Anak Titisan Naga',
    'Manusia Harimau dari Lereng Merapi', 'Siluman Buaya Kali Ciliwung', 'Putri Duyung Pantai Selatan', 'Bidadari Terakhir Kahyangan', 'Jerat Siluman Kera',
    'Naga Emas dari Langit', 'Kalung Penangkal Siluman', 'Jin Botol Minta Pulang', 'Pengantin Siluman', 'Ratu Siluman Gagak',
    'Dendam Siluman Ular Putih', 'Kekasih dari Alam Gaib', 'Mutiara Sakti Ratu Kidul', 'Selendang Bidadari Dicuri', 'Elang Sakti Penjaga Lembah',
    'Tongkat Ajaib Kakek Sakti', 'Suamiku Ternyata Manusia Harimau', 'Gadis Bermata Ular', 'Raja Siluman Kalajengking', 'Pusaka Naga Geni',
  ],
  kolosal: [
    'Babad Kerajaan Majaraya', 'Pedang Naga Puspa', 'Sumpah Sang Patih', 'Prahara Tanah Jawa', 'Mahkota Berdarah',
    'Ratu Pantai Utara', 'Pendekar Tongkat Emas', 'Keris Sakti Mpu Gandring', 'Perang Dua Saudara', 'Panji Sakti dari Timur',
    'Kitab Ilmu Lima Unsur', 'Dendam Sang Adipati', 'Raden Arya Pamungkas', 'Tahta Terakhir', 'Kerajaan di Atas Awan',
    'Laksamana dari Selatan', 'Putri Kencana Sari', 'Senopati Pamungkas', 'Pusaka Kerajaan yang Hilang', 'Sang Prabu dari Pajajaran',
    'Pertempuran Bukit Tengkorak', 'Jaka Lelana Pendekar Pengembara', 'Selendang Sang Permaisuri', 'Mahapatih Cilik', 'Pewaris Tahta Galuh',
  ],
};

// ------------------------------------------------------------------ handwritten theme titles (genre-tagged)
// [genres ("*" = any), title]
export const THEME_WHOLE: Record<string, [string, string][]> = {
  kampung: [
    ['romansa,keluarga', 'Gadis Desa yang Ditinggal ke Kota'], ['komedi', 'Kepala Desa Kebanyakan Rapat'], ['keluarga', 'Sawah Terakhir Bapak'],
    ['horor', 'Jangan Lewat Kebun Bambu Malam-Malam'], ['romansa', 'Kembang Desa Rebutan Tiga Pemuda'], ['religi', 'Azan Pertama di Kampung Kami'],
    ['azab', 'Azab Kades Korup, Jenazahnya Terseret Banjir Bandang'], ['komedi', 'Pos Ronda Mendadak Rame'], ['laga', 'Jawara Kampung Turun Gunung'],
  ],
  kota: [
    ['romansa', 'CEO Galak Jatuh Cinta Sama Driver Ojol'], ['keluarga', 'Hidup di Ibu Kota Itu Keras, Nak'], ['komedi', 'Anak Kampung Nyasar ke Mall'],
    ['azab', 'Azab Pejabat Korup, Rumah Mewahnya Ditelan Bumi'], ['romansa', 'Cinta Terjebak Macet'], ['horor', 'Penghuni Apartemen Lantai 13'],
    ['laga', 'Preman Terminal Tobat'], ['remaja', 'Anak Komplek vs Anak Gang'],
  ],
  sekolah: [
    ['remaja,romansa', 'Ketua OSIS Naksir Anak Bandel'], ['komedi', 'Guru Honorer Banyak Akal'], ['remaja', 'Kelas Paling Ribut Satu Angkatan'],
    ['horor', 'Hantu Toilet Lantai Dua'], ['keluarga', 'Seragam Bekas Kakak'], ['remaja', 'Surat Cinta di Laci Meja'],
    ['religi', 'Rohis Juga Bisa Jatuh Cinta'], ['romansa', 'Cinta Lama Bersemi di Reuni SMA'],
  ],
  pasar: [
    ['romansa,komedi', 'Tukang Cilok Jatuh Cinta Sama Anak Juragan Empang'], ['komedi', 'Juragan Beras Pelit Sedunia'], ['keluarga', 'Emak Penjual Sayur Kuliahkan Lima Anak'],
    ['azab', 'Azab Pedagang Curang Timbangan, Jenazahnya Tertimbun Beras'], ['laga', 'Jagoan Pasar Subuh'], ['romansa', 'Cinta Bersemi di Los Ikan'],
    ['religi', 'Tukang Sayur Rajin Sedekah'], ['komedi', 'Kuli Panggul Mendadak Jadi Bos Pasar'],
  ],
  pesantren: [
    ['romansa,religi', 'Santri Bandel Jatuh Hati Sama Putri Kiai'], ['religi', 'Sarung Hijau Pemberian Abah'], ['komedi', 'Santri Kabur Lewat Jendela'],
    ['religi,keluarga', 'Ning Pulang ke Pondok'], ['azab', 'Azab Penipu Berkedok Ustaz, Kuburannya Terbelah Dua'], ['horor', 'Teror Asrama Putri Saat Liburan'],
    ['romansa', 'Ta\'aruf Tiga Hari'], ['remaja', 'Santri Gaul Ikut Lomba Hadroh'],
  ],
  kantor: [
    ['romansa', 'Bos Galak Naksir OB Kantor'], ['komedi', 'Senin Harga Mati'], ['romansa', 'Nikah Kontrak Sama Pak Direktur'],
    ['horor', 'Lembur Malam di Lantai Tujuh'], ['azab', 'Azab Bos Pelit, Jenazahnya Tertahan di Lift Kantor'], ['keluarga', 'Ayah Lembur Terus'],
    ['komedi', 'Anak Magang Bikin Ribet'], ['laga', 'Satpam Kantor Ternyata Mantan Jawara'],
  ],
  rumahsakit: [
    ['romansa', 'Dokter Muda Jatuh Cinta Sama Pasien Sendiri'], ['keluarga', 'Doa Ibu di Ruang ICU'], ['horor', 'Suster Jaga Shift Malam'],
    ['religi', 'Mukjizat di Ruang Operasi'], ['azab', 'Azab Dokter Mata Duitan, Jenazahnya Hilang dari Kamar Mayat'], ['komedi', 'Dokter Koas Gampang Pingsan'],
    ['romansa', 'Cinta di Antara Jarum Infus'], ['keluarga', 'Ayah Menjual Motor Demi Operasi Adik'],
  ],
  kos: [
    ['komedi', 'Ibu Kos Galak, Anak Kos Bokek'], ['horor', 'Kamar 13 Jangan Dibuka'], ['romansa', 'Cinta Lokasi Kos Putra-Putri'],
    ['komedi', 'Mi Instan Akhir Bulan'], ['remaja', 'Anak Kos Dadakan'], ['azab', 'Azab Ibu Kos Pelit, Kuburannya Ditagih Uang Sewa'],
    ['romansa', 'Tetangga Kamar Bikin Baper'], ['keluarga', 'Kiriman Wesel dari Emak'],
  ],
  kampus: [
    ['romansa', 'Dosen Killer Jatuh Cinta Sama Mahasiswa Abadi'], ['komedi', 'Skripsi Tak Kunjung Kelar'], ['romansa', 'KKN di Desa Penari Jaipong'],
    ['remaja', 'Maba Paling Polos'], ['horor', 'Penunggu Gedung Fakultas Lama'], ['religi', 'Hijrahnya Anak Teknik'],
    ['keluarga', 'Wisuda Tanpa Bapak'], ['romansa', 'Asdos Ganteng Pilih Kasih'],
  ],
  hutan: [
    ['horor', 'Jangan Kencing Sembarangan di Hutan'], ['siluman', 'Penunggu Pohon Beringin Minta Tumbal'], ['laga', 'Pendekar Lembah Hitam'],
    ['horor', 'Pendakian Terakhir'], ['romansa', 'Tersesat Berdua di Gunung'], ['azab', 'Azab Pembalak Liar, Jenazahnya Dililit Akar Beringin'],
    ['kolosal', 'Pertapa Goa Larangan'], ['siluman', 'Kera Sakti dari Gunung Kidul'],
  ],
  kerajaan: [
    ['romansa', 'Pangeran Jatuh Cinta Sama Dayang Istana'], ['kolosal', 'Pengkhianatan Sang Patih'], ['komedi', 'Raja Kebanyakan Selir'],
    ['siluman', 'Permaisuri Titisan Ular'], ['keluarga', 'Putri yang Dibuang dari Istana'], ['laga', 'Prajurit Keraton Terakhir'],
    ['horor', 'Kutukan Sumur Keraton'], ['romansa', 'Pengawal Pribadi Sang Putri'],
  ],
  laut: [
    ['siluman', 'Ratu Penguasa Ombak Selatan'], ['romansa', 'Gadis Pantai dan Pelaut Muda'], ['keluarga', 'Bapak Belum Pulang Melaut'],
    ['horor', 'Jangan Pakai Baju Hijau di Pantai'], ['azab', 'Azab Pengebom Ikan, Jenazahnya Diseret Ombak'], ['laga', 'Bajak Laut Selat Sunda'],
    ['kolosal', 'Laksamana Penjaga Samudra'], ['komedi', 'Kapal Odong-Odong Mogok di Tengah Laut'],
  ],
};

// ------------------------------------------------------------------ slot templates per genre
// {m} {f} {ma} {fa} {who} {bad} {elder} {place} {spot} {turf} {item} {ghost} {animal} {fate}
export const TEMPLATES: Record<string, string[]> = {
  romansa: [
    '{m} Jatuh Cinta Sama {f}', '{f} Jatuh Hati Sama {m}', 'Jodohku Ternyata {who}', 'Mendadak Dilamar {m}', 'Cinta Bersemi {place}',
    'Hatiku Tertinggal {place}', 'Ketika {m} Melamar {f}', 'Kontrak Cinta Sama {m}', 'Dijodohkan Sama {m}', 'Pacarku {who}',
    'Cinta Segitiga {place}', 'Gara-Gara {item}, Aku Jatuh Cinta', 'Istriku {fa}', 'Calon Suamiku {ma}', 'Rahasia Cinta {f}',
  ],
  komedi: [
    '{who} Mendadak Kaya', '{who} Mendadak Viral', 'Gara-Gara {item}', 'Geger {item} Hilang', 'Kacau Balau {place}',
    '{m} Kena Prank', 'Bukan {m} Biasa', 'Duh, {m} Lagi Kasmaran', 'Salah Melamar {f}', 'Heboh {place}',
    '{m} Cari Jodoh', 'Drama {item} Satu RT',
  ],
  keluarga: [
    'Air Mata {elder}', 'Menantuku {ma}', 'Suamiku {ma}', 'Istriku {fa}',
    'Pulang ke Pelukan {elder}', 'Suara Hati Istri: Suamiku Pulang Bawa {fa}',
    '{elder}, Maafkan Anakmu', 'Doa {elder} di Sepertiga Malam',
  ],
  azab: [
    'Azab {bad}, {fate}', 'Azab {bad}, {fate}', 'Azab {bad}, {fate}', 'Akhir Hidup {bad}', 'Detik-Detik Terakhir {bad}',
    'Kisah Nyata: Jenazah {bad} Tak Mau Dikubur', 'Suara Hati Istri: Suamiku Pulang Bawa {fa}', 'Azab {bad}',
  ],
  religi: [
    'Hidayah untuk {who}', 'Tabungan Haji {ma}', 'Taubatnya {bad}', 'Hijrahnya {who}', 'Doa Sepertiga Malam {who}',
    'Cahaya {place}', 'Doa {elder} di Sepertiga Malam', 'Sujud Terakhir {who}', 'Mukjizat {place}',
  ],
  remaja: [
    'Pacarku {who}', 'Gebetanku {who}', 'Cinta Monyet {place}', 'Jangan Panggil Aku {who}', 'Naksir {who}',
    'Galau Maksimal {place}', 'Gara-Gara {item}', 'Ciee, Naksir {m}', 'Geng Rusuh {place}',
  ],
  horor: [
    'Penunggu {spot}', 'Misteri {spot}', 'Jangan Lewat {spot} Malam-Malam', 'Teror {ghost} {place}', 'Malam Jumat Kliwon {place}',
    'Ada yang Ketawa {place}', 'Arwah {who} Gentayangan', '{ghost} {place}', '{m} Kesurupan',
  ],
  laga: [
    'Jagoan {turf}', 'Preman {turf}', '{m} Jago Silat', 'Pendekar {turf}', 'Duel Maut {place}',
    'Si Kilat dari {turf}', 'Pertarungan Terakhir {place}', '{m} Bukan Orang Sembarangan',
  ],
  siluman: [
    'Siluman {animal} Penunggu {spot}', '{f} Ternyata Siluman {animal}', 'Suamiku Siluman {animal}', 'Istriku Siluman {animal}', 'Jerat Siluman {place}',
    'Ratu Siluman {turf}', 'Kutukan Siluman {animal}',
  ],
  kolosal: [
    'Legenda {turf}', 'Prahara {turf}', 'Pusaka Sakti {turf}', 'Pendekar {turf}',
    'Babad {turf}', 'Pewaris Tahta {turf}', 'Kemelut di {turf}',
  ],
};

// ------------------------------------------------------------------ rendering helpers
const LOWER = new Set(['di', 'ke', 'dan', 'yang', 'dari', 'untuk', 'pada', 'vs']);
/** title case for Indonesian TV titles: particles stay lowercase except at the start of a (sub)title */
export function tidy(s: string): string {
  const words = s.replace(/\s+/g, ' ').trim().split(' ');
  let start = true;
  return words.map((w) => {
    const bare = w.toLowerCase();
    let out = w;
    if (!start && LOWER.has(bare)) out = bare;
    else if (/^[a-z]/.test(w)) out = w[0].toUpperCase() + w.slice(1);
    start = /[:]$/.test(w);
    return out;
  }).join(' ');
}

function fill(tpl: string, v: Vocab, r: Rnd): string | null {
  let bad = false;
  const out = tpl.replace(/\{(\w+)\}/g, (_, k: string) => {
    switch (k) {
      case 'm': return pick(v.m, r);
      case 'f': return pick(v.f, r);
      case 'ma': return pick(v.ma ?? v.m, r);
      case 'fa': return pick(v.fa ?? v.f, r);
      case 'who': return pick(r() < 0.5 ? v.m : v.f, r);
      case 'bad': return pick(v.bad, r);
      case 'elder': return pick(v.elder, r);
      case 'place': return pick(v.place, r);
      case 'spot': return pick(v.spot, r);
      case 'turf': if (!v.turf.length) { bad = true; return ''; } return pick(v.turf, r);
      case 'item': return pick(v.item, r);
      case 'ghost': return pick(GHOST, r);
      case 'animal': return pick(ANIMAL, r);
      case 'fate': return pick(v.fate && r() < 0.45 ? v.fate : FATE, r);
      default: bad = true; return '';
    }
  });
  return bad ? null : out;
}

export interface TitleHistory { title: string; genre: string; theme: string; total: number }
export interface TitleOpts { used?: Iterable<string>; history?: TitleHistory[]; noSequel?: boolean }

const SEQ_RE = /\s+(?:(\d+)|Season (\d+)|Reborn)$/;
function baseTitle(t: string) { return t.replace(SEQ_RE, ''); }

/** a sequel title, only for a real hit of the same genre+theme in the save's history */
function sequel(genre: string, theme: string, r: Rnd, hist: TitleHistory[], used: Set<string>): string | null {
  const hits = hist.map((h, i) => ({ h, i })).filter(({ h }) => h.genre === genre && h.theme === theme && h.total >= 28);
  if (!hits.length) return null;
  const { h, i } = hits[hits.length - 1];
  const base = baseTitle(h.title);
  if (base.length > 34) return null;
  const family = hist.filter((x) => baseTitle(x.title) === base).length; // how many parts exist
  const oldHit = hist.length - 1 - i >= 4;
  let t: string;
  if (oldHit && r() < 0.5) t = base + ' Reborn';
  else if (family === 1) t = base + (r() < 0.5 ? ' 2' : ' Season 2');
  else {
    const m = /Season (\d+)$/.exec(h.title);
    t = m ? `${base} Season ${Number(m[1]) + 1}` : `${base} ${family + 1}`;
  }
  return used.has(t.toLowerCase()) ? null : t;
}

export function makeTitle(genre: string, theme: string, rnd: Rnd, opts: TitleOpts = {}): string {
  const used = new Set<string>();
  for (const u of opts.used ?? []) used.add(u.toLowerCase());
  for (const h of opts.history ?? []) used.add(h.title.toLowerCase());
  if (!opts.noSequel && opts.history && opts.history.length && rnd() < 0.22) {
    const s = sequel(genre, theme, rnd, opts.history, used);
    if (s) return s;
  }
  const v = VOCAB[theme] ?? VOCAB.kampung;
  const whole = WHOLE[genre] ?? WHOLE.romansa;
  const tpls = TEMPLATES[genre] ?? TEMPLATES.romansa;
  const themed = (THEME_WHOLE[theme] ?? []).filter(([g]) => g === '*' || g.split(',').includes(genre)).map(([, t]) => t);
  let last = '';
  for (let tries = 0; tries < 60; tries++) {
    const x = rnd();
    let t: string | null;
    if (themed.length && x < 0.18) t = pick(themed, rnd);
    else if (x < 0.55) t = fill(pick(tpls, rnd), v, rnd);
    else t = pick(whole, rnd);
    if (!t) continue;
    t = tidy(t);
    if (t.length > 64) continue;
    last = t;
    if (!used.has(t.toLowerCase())) return t;
  }
  return last || tidy(pick(whole, rnd));
}


/** v4 spin-off / sequel titles for a chosen parent show (Spin-off menu in the production wizard) */
export function franchiseBase(t: string): string { return baseTitle(t).replace(/:\s.*$/, ''); }
export function sequelTitle(parent: TitleHistory, rnd: Rnd, hist: TitleHistory[]): string {
  const used = new Set(hist.map((h) => h.title.toLowerCase()));
  const base = franchiseBase(parent.title);
  const family = hist.filter((x) => franchiseBase(x.title) === base).length;
  const cands: string[] = [];
  const m = /Season (\d+)$/.exec(parent.title);
  if (m) cands.push(`${base} Season ${Number(m[1]) + 1}`);
  cands.push(family <= 1 ? `${base} 2` : `${base} ${family + 1}`, `${base} Season ${family + 1}`);
  if (family >= 2) cands.push(`${base} Reborn`, `${base}: Babak Terakhir`);
  for (let i = 0; i < 12; i++) {
    const t = pick(cands, rnd);
    if (!used.has(t.toLowerCase())) return t;
  }
  return `${base} ${family + 1}`;
}
export function spinoffTitle(parent: TitleHistory, theme: string, rnd: Rnd, hist: TitleHistory[]): string {
  const used = new Set(hist.map((h) => h.title.toLowerCase()));
  const base = franchiseBase(parent.title);
  const v = VOCAB[theme] ?? VOCAB.kampung;
  const ph = v.place && v.place.length ? pick(v.place, rnd) : 'di Kota';
  const w = ph.replace(/^di\s+/, '');
  const pool = [`${base} Goes to ${w}`, `${base}: Kisah ${ph}`, `${base} Junior`, `${base}: Babak Baru`, `Kisah Lain ${base}`, `${base} ${ph}`];
  for (let i = 0; i < 14; i++) {
    const t = tidy(pick(pool, rnd)).replace(' Goes To ', ' Goes to ');
    if (t.length <= 64 && !used.has(t.toLowerCase())) return t;
  }
  return `${base}: Babak Baru ${hist.length}`;
}

// ------------------------------------------------------------------ rivals and critics
export const RIVAL_TITLES = [
  'Ikrar Cinta Dua Keluarga', 'Menantu Pilihan Mama', 'Tukang Bakso Naik Pelaminan', 'Anak Jalanan Jadi Jutawan', 'Cinta Setengah Mati',
  'Pengantin Rahasia', 'Air Mata di Balik Cadar', 'Suamiku Milik Sahabatku', 'Dunia Terbalik Pak Haji', 'Jodoh Salah Kamar',
  'Preman Kampung Pensiun Dini', 'Para Pencari Sinyal', 'Bidadari Pasar Minggu', 'Mertua Rasa Tetangga', 'Istri Pilihan Kakek',
  'Sumpah Cinta Anak Juragan', 'Putri Tertukar di Rumah Sakit', 'Kau Rebut Suamiku', 'Kisah Nyata: Tukang Parkir Masuk Surga', 'Serigala Kota',
  'Bawang Bombay, Bawang Putih', 'Lima Menantu Ibu Romlah', 'Kumbang Cinta', 'Satria Kecil Bermotor', 'Nikah Kilat Sang Pewaris',
];

const CRITIC_LINES: Record<number, string[]> = {
  1: ['Ganti channel aja deh', 'Ini sinetron apa sinyal ilang?', 'Mending nonton iklan', 'Pusing, gak jelas arahnya', 'Nyesel begadang', 'Ampun, gak ada niat', 'Remote mana remote?', 'Rugi listrik'],
  2: ['Bikin ngantuk', 'Kok gini doang?', 'Episodenya kepanjangan', 'Ceritanya muter-muter', 'Kurang greget', 'Tokohnya nyebelin semua', 'Hmm... b aja', 'Kebanyakan iklan'],
  3: ['Lumayan buat nemenin makan', 'Standar sinetron lah', 'Ada bagusnya dikit', 'Masih bisa ditonton', 'Endingnya ketebak', 'Biasa aja sih', 'OST-nya enak doang', 'Not bad lah'],
  4: ['Chemistry pemerannya kuat', 'Gak sabar episode besok', 'Emak-emak pasti suka', 'Seru, bikin nagih!', 'Mantul, lanjutkan!', 'OST-nya nempel di kepala', 'Rela begadang!'],
  5: ['Merinding! Juara!', 'Sinetron terbaik tahun ini', 'Gila, ini mahakarya', 'Satu Indonesia nonton!', 'Wajib ditonton!', 'Trending tiap malam', 'Kasih piala sekarang!'],
};
// lines tied to what each critic watches for: [low (1-4), high (7-10)]
const FAV_LINES: Record<string, [string[], string[]]> = {
  drama: [['Plotnya bolong-bolong', 'Konfliknya maksa', 'Plot twist-nya basi'], ['Plot twist-nya dapet!', 'Antagonisnya bikin geregetan', 'Konfliknya nendang']],
  airmata: [['Gak ada yang bikin sedih', 'Nangisnya kayak dibuat-buat', 'Kurang menyentuh'], ['Nangis sampe pagi', 'Baper parah', 'Tisu sekotak abis']],
  komedi: [['Lawakannya garing', 'Receh tapi gak lucu', 'Gak ketawa sekali pun'], ['Ngakak terus!', 'Receh tapi kena', 'Perut sakit ketawa']],
  visual: [['Zoom-in mulu', 'Kameranya goyang terus', 'Efek CGI-nya kocak'], ['Gambarnya cakep banget', 'Kualitas bioskop!', 'Sinematografinya juara']],
};
export function criticComment(score: number, rnd: () => number, avoid: string[] = [], fav?: string): string {
  const band = score <= 2 ? 1 : score <= 4 ? 2 : score <= 6 ? 3 : score <= 8 ? 4 : 5;
  const favLines = fav && FAV_LINES[fav] ? (band <= 2 ? FAV_LINES[fav][0] : band >= 4 ? FAV_LINES[fav][1] : []) : [];
  const base = favLines.length && rnd() < 0.45 ? favLines : CRITIC_LINES[band];
  const pool = base.filter((c) => !avoid.includes(c));
  const src = pool.length ? pool : CRITIC_LINES[band];
  return src[Math.floor(rnd() * src.length)];
}
export const __critics = CRITIC_LINES;
export const __favCritics = FAV_LINES;
