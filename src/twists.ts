// v4: Kartu Plot Twist. Pure data + helpers (no Phaser), plus 16x16 pixel icons drawn at runtime.

export interface TwistDef {
  id: string; name: string; fit: string[]; boost: number;
  unlockShows: number; unlockYear: number;
  /** what happens on screen */
  line: string;
  /** what a critic says when it is overused */
  mock: string;
  /** 16x16 pixel icon, palette chars below */
  icon: string[];
  sting: 'drama' | 'good' | 'roll';
}

// palette: . transparent, K outline, W white, S skin, R red, B blue, Y yellow, G green, P pink, D dark grey, L light grey, O orange, N brown, V violet
export const TW_PAL: Record<string, string> = {
  K: '#2b1a10', W: '#fff8e8', S: '#f0c08a', R: '#e0402a', B: '#4a8ad0', Y: '#ffd23a', G: '#5ab04a', P: '#f08ab0', D: '#5a5a66', L: '#c8c8d0', O: '#f08a2a', N: '#8a5a2a', V: '#8a4ad0',
};

export const TWISTS: TwistDef[] = [
  {
    id: 'zoom', name: 'Zoom-in 3x', fit: ['azab', 'keluarga', 'romansa', 'religi'], boost: 0.14, unlockShows: 0, unlockYear: 1,
    line: 'Kamera zoom ke muka kaget. Zoom lagi. ZOOM LAGI! Jeng jeng jeng!', mock: 'Zoom-in 3x terus, kameramennya kesurupan?', sting: 'drama',
    icon: [
      '................',
      '...KKKKKKKKK....',
      '..KWWWWWWWWWK...',
      '.KWWWKKKKKWWWK..',
      '.KWWKBBBBBKWWK..',
      'KWWKBBKKKBBKWWK.',
      'KWWKBKKWKKBKWWK.',
      'KWWKBKKKKKBKWWK.',
      'KWWKBBKKKBBKWWK.',
      '.KWWKBBBBBKWWK..',
      '.KWWWKKKKKWWWK..',
      '..KWWWWWWWWWK...',
      '...KKKKKKKKK....',
      '..KYK.KYK.KYK...',
      '..KYK.KYK.KYK...',
      '...K...K...K....',
    ],
  },
  {
    id: 'amnesia', name: 'Amnesia', fit: ['romansa', 'keluarga', 'remaja'], boost: 0.16, unlockShows: 1, unlockYear: 1,
    line: 'Tokoh utama kepentok meja, bangun-bangun lupa semuanya. "Aku di mana? Kamu siapa?"', mock: 'Amnesia lagi? Penulisnya yang amnesia kali.', sting: 'drama',
    icon: [
      '................',
      '.....KKKKKK.....',
      '....KWWWWWWK....',
      '...KWWRWWWWWK...',
      '...KWWWWWWWWK...',
      '...KSSSSSSSSK...',
      '...KSKSSSSKSK...',
      '...KSSSSSSSSK...',
      '...KSSSKKSSSK...',
      '....KSSSSSSK....',
      '.....KKKKKK.....',
      '..........KKK...',
      '.........KYYYK..',
      '...........YK...',
      '..........YK....',
      '..........Y.....',
    ],
  },
  {
    id: 'tertukar', name: 'Anak Tertukar', fit: ['keluarga', 'azab', 'religi'], boost: 0.18, unlockShows: 1, unlockYear: 1,
    line: 'Ternyata 20 tahun lalu, bayinya tertukar di rumah sakit! Gelang bayinya beda!', mock: 'Anak tertukar mulu, rumah sakitnya nggak pernah dievaluasi?', sting: 'drama',
    icon: [
      '................',
      '..KKKK....KKKK..',
      '.KPPPPK..KBBBBK.',
      '.KPSSPK..KBSSBK.',
      '.KPSSPK..KBSSBK.',
      '.KPPPPK..KBBBBK.',
      '..KKKK....KKKK..',
      '................',
      '...KK......KK...',
      '..KOOK....KOOK..',
      '.KOOOOKKKKOOOOK.',
      '..KOOK....KOOK..',
      '...KK......KK...',
      '................',
      '.......KK.......',
      '......K??K......',
    ].map((r) => r.replace(/\?/g, 'Y')),
  },
  {
    id: 'ketabrak', name: 'Ketabrak Mobil', fit: ['romansa', 'remaja', 'keluarga', 'azab'], boost: 0.17, unlockShows: 2, unlockYear: 1,
    line: 'Lagi nyebrang sambil nangis, CKIIIT! Mobil putih datang entah dari mana!', mock: 'Ketabrak mobil lagi. Kotanya nggak punya zebra cross?', sting: 'drama',
    icon: [
      '................',
      '................',
      '....KKKKKKK.....',
      '...KWWBWBWWK....',
      '..KWWWBWBWWWK...',
      '.KKKKKKKKKKKKK..',
      '.KWWWWWWWWWWWYK.',
      '.KWWWWWWWWWWWWK.',
      '.KKKKKKKKKKKKKK.',
      '..KDDK....KDDK..',
      '..KDLK....KDLK..',
      '...KK......KK...',
      '................',
      'R.R.R...........',
      '.R.R............',
      'R.R.R...........',
    ],
  },
  {
    id: 'azab', name: 'Azab Mendadak', fit: ['azab', 'religi'], boost: 0.2, unlockShows: 3, unlockYear: 1,
    line: 'Si pelit tiba-tiba disambar petir pas lagi ngitung duit! Jenazahnya nggak muat liang lahat!', mock: 'Azabnya kebanyakan, penonton yang kena azab nonton ini.', sting: 'drama',
    icon: [
      '................',
      '...KKKKKKKK.....',
      '..KDDDDDDDDK....',
      '.KDDLDDDLDDDK...',
      '.KDDDDDDDDDDK...',
      '..KKKKKKKKKK....',
      '......KYK.......',
      '.....KYYK.......',
      '....KYYYKKK.....',
      '....KKKYYYK.....',
      '......KYYK......',
      '......KYK.......',
      '.....KYK........',
      '.....KK.........',
      '................',
      '................',
    ],
  },
  {
    id: 'kembaran', name: 'Kembaran Jahat', fit: ['romansa', 'laga', 'siluman', 'horor'], boost: 0.18, unlockShows: 3, unlockYear: 2,
    line: 'Ternyata dia punya kembaran! Bedanya cuma tahi lalat dan senyum licik.', mock: 'Kembaran jahat lagi. Ibu mereka lahiran berapa kali sih?', sting: 'drama',
    icon: [
      '................',
      '.KKKKK...KKKKK..',
      'KNNNNNK.KNNNNNK.',
      'KSSSSSK.KSSSSSK.',
      'KSKSKSK.KRSKRSK.',
      'KSSSSSK.KSSKSSK.',
      'KSKKKSK.KSKSKSK.',
      '.KSSSK...KKSKK..',
      '..KKK.....KKK...',
      '.KBBBK...KVVVK..',
      'KBBBBBK.KVVVVVK.',
      'KBBBBBK.KVVVVVK.',
      '................',
      '..KGK.....KRK...',
      '..KGK.....KRK...',
      '................',
    ],
  },
  {
    id: 'hidup', name: 'Hidup Lagi Setelah Mati', fit: ['siluman', 'horor', 'kolosal', 'laga'], boost: 0.2, unlockShows: 4, unlockYear: 2,
    line: 'Udah dikubur 30 episode, eh tiba-tiba muncul di pesta pernikahan. "Aku kembali!"', mock: 'Yang mati hidup lagi. Kuburannya pintu putar ya?', sting: 'drama',
    icon: [
      '......KKKK......',
      '.....KWWWWK.....',
      '....KWKWWKWK....',
      '....KWWWWWWK....',
      '....KWWKKWWK....',
      '...KWWWWWWWWK...',
      '...KWWWWWWWWK...',
      '....KWKWWKWK....',
      '.....K.KK.K.....',
      '................',
      '..KKKKKKKKKKKK..',
      '.KNNNNNNNNNNNNK.',
      '.KNKNNNNNNNNKNK.',
      '.KNNNNNNNNNNNNK.',
      '..KKKKKKKKKKKK..',
      '................',
    ],
  },
  {
    id: 'kontrak', name: 'Pernikahan Kontrak', fit: ['romansa', 'remaja', 'komedi'], boost: 0.17, unlockShows: 4, unlockYear: 3,
    line: 'CEO dingin nawarin nikah kontrak 1 tahun. Syaratnya: jangan jatuh cinta! (Pasti jatuh cinta.)', mock: 'Nikah kontrak lagi. Kontraknya diperpanjang tiap sinetron.', sting: 'good',
    icon: [
      '................',
      '...KKKKKKKKK....',
      '...KWWWWWWWK....',
      '...KWKKKKKWK....',
      '...KWWWWWWWK....',
      '...KWKKKKWWK....',
      '...KWWWWWWWK....',
      '...KWKKKWWWK.KK.',
      '...KWWWWWWWKKYYK',
      '...KWWWWKRKKY..Y',
      '...KWWWWWKKKY..Y',
      '...KKKKKKKK.KYYK',
      '.............KK.',
      '................',
      '................',
      '................',
    ],
  },
  {
    id: 'mimpi', name: 'Ternyata Cuma Mimpi', fit: ['komedi', 'horor', 'remaja'], boost: 0.15, unlockShows: 5, unlockYear: 3,
    line: 'Semua kejadian 10 episode terakhir... ternyata cuma mimpi! Penonton: HAH?!', mock: 'Cuma mimpi lagi. Kami yang pengen bangun dari sinetron ini.', sting: 'roll',
    icon: [
      '................',
      '..........KKKK..',
      '.........K.WW.K.',
      '........K.WWWW.K',
      '..KK....K.WWWW.K',
      '.KWWK....K.WW.K.',
      '.KWWK.....KKKK..',
      '..KK...KK.......',
      '......KWWK......',
      '......KWWK......',
      '.......KK.......',
      '.KKKKKKKKKKKKK..',
      'KSSSSSSKBBBBBBK.',
      'KSKSSKSKBBBBBBK.',
      'KKKKKKKKKKKKKKK.',
      '................',
    ],
  },
  {
    id: 'siluman', name: 'Berubah Jadi Siluman', fit: ['siluman', 'kolosal', 'horor', 'azab'], boost: 0.2, unlockShows: 6, unlockYear: 4,
    line: 'Pas bulan purnama, mertua berubah jadi siluman ular! CGI-nya... ya gitu deh.', mock: 'Siluman lagi, budget CGI-nya dari tutup botol.', sting: 'drama',
    icon: [
      '................',
      '.......KKKK.....',
      '......KGGGGK....',
      '.....KGRGGRGK...',
      '.....KGGGGGGK...',
      '......KGGRKK....',
      '.......KGK.R....',
      '......KGGK......',
      '.....KGGK.......',
      '....KGGK...KK...',
      '....KGGGKKKGGK..',
      '.....KGGGGGGGK..',
      '......KKKKKKK...',
      '................',
      '..Y..........Y..',
      '.YYY........YYY.',
    ],
  },
];

export function twistById(id: string) { return TWISTS.find((t) => t.id === id); }

export function twistUnlocked(t: TwistDef, shows: number, year: number): boolean {
  return shows >= t.unlockShows && year >= t.unlockYear;
}

export const TWIST_COOLDOWN = 3;
export const TWIST_WEEKS = 2;
export const MUAK_CAP = 0.35;

/** netizen reactions to a twist (fresh vs. overused) */
export const NETIZEN_HAPPY = ['"ASTAGAAA! Nggak nyangka!" #SinetronStory trending', '"Emak gue sampe lempar sandal ke TV"', '"Twist-nya gila sih, besok wajib nonton"', '"Merinding! Grup WA keluarga heboh"'];
export const NETIZEN_MUAK = ['"Yaelah, ini lagi..." netizen mulai muak', '"Penulisnya kehabisan ide ya?"', '"Ganti channel ah, twist-nya basi"', '"Plot twist kok bisa ditebak dari episode 1"'];
