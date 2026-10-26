// ============================================================
// ドット絵のデータ (pixel-data.js)
//  絵は「文字の並び」で描いてある。1文字＝1ドット。'.' は透明。
//  色は文字ごとにパレットで決まる（pixel.js が、チームの色・レア度の色・敵の色に差し替える）。
//
//  ［人物］ k=ふち  h/H=髪  s/S=はだ  e=目  c/C/l=服(基本/影/ハイライト)  b=くつ  w=白
//  ［武器］ a/b/c=刃や本体(レア度の色の 明/中/暗)  h/H=木の柄  g/G=金具  s/S=鉄  r=赤  w=白  k=ふち
//  ［敵］   m/M/L=体の色(基本/影/明)  k=ふち  w=白  e=赤い目  y=黄  r=赤
//
//  すべて「上向き」に描いてある武器は、持つ向きに合わせて回転して使う。grip＝持ち手の行（回転の中心）
// ============================================================
(function () {
    'use strict';
    // ---------- 人物（右向き。左向きは反転して使う）----------
    const BODY_TOP = [
        '...kkkk...',
        '..khhhhk..',
        '.khhhhhhk.',
        '.khhhsssk.',
        '.khhsesSk.',
        '..khssssk.',
        '...kssSk..',
        '..kcccck..',
        '.kccllcck.',
        '.ksccllck.',
        '.ksccccCk.',
        '..kccccCk.'
    ];
    const LEGS = {
        idle: ['..kbkkbk..', '..kbkkbk..'],
        walkA: ['.kbk..kbk.', '.kbk..kbk.'],
        walkB: ['..kbk.kbk.', '..kbk.kbk.']
    };

    // ---------- 武器（上向き）----------
    const WEAPONS = {
        sword: { grip: 12, rows: [
            '...a...', '..aab..', '..aab..', '..aab..', '..aab..', '..aab..', '..aab..', '..aab..',
            '..abc..', '..abc..', '.ggggg.', '..GhG..', '...h...', '...h...', '...H...', '...gg..'] },
        greatsword: { grip: 14, rows: [
            '....a....', '...aab...', '...aab...', '..aaabb..', '..aaabb..', '..aaabb..', '..aaabb..', '..aaabb..',
            '..aaabb..', '..aaabb..', '..aabbc..', '..abbcc..', '.ggggggg.', '..GgGgG..', '....h....', '....h....', '....H....', '...ggg...'] },
        dagger: { grip: 7, rows: [
            '..a..', '.aab.', '.aab.', '.aab.', '.abc.', 'ggggg', '.GhG.', '..h..', '..H..', '.ggg.'] },
        katana: { grip: 14, rows: [
            '....a', '...ab', '...ab', '..aab', '..ab.', '..ab.', '..ab.', '..ab.', '..ab.', '.aab.', '.abc.', '..cc.', '.gGg.', '..h..', '..H..', '..h..', '..H..', '..g..'] },
        spear: { grip: 14, rows: [
            '..a..', '.aab.', '.aab.', '.abc.', '..b..', '.gGg.', '..h..', '..h..', '..h..', '..h..', '..h..', '..H..', '..h..', '..h..', '..H..', '..h..', '..h..', '..H..', '.GgG.', '..g..'] },
        halberd: { grip: 15, rows: [
            '...a...', '..aab..', '..abb..', '..aabbb', '.aaabbb', '.aaabbc', '..aabc.', '..abc..', '...g...', '...h...', '...h...', '...H...', '...h...', '...h...', '...H...', '...h...', '...h...', '...H...', '..GgG..', '...g...'] },
        scythe: { grip: 14, rows: [
            '..aaaaa..', '.aabbbbb.', 'aab...bbc', 'ab.....bc', 'a.......c', '.....h...', '.....h...', '.....h...', '.....H...', '.....h...', '.....h...', '.....H...', '.....h...', '.....h...', '....ggg..', '.....H...', '.....h...', '.....g...'] },
        axe: { grip: 8, rows: [
            '.aaab.h.', 'aaaabbh.', 'aaaabbh.', 'aaaabch.', '.aabccH.', '..bcc.h.', '......h.', '......H.', '......h.', '......h.', '......H.', '.....ggg', '......g.'] },
        hammer: { grip: 10, rows: [
            '.ssssss.', 'sSbbbbSs', 'sSbaabSs', 'sSbbbbSs', '.ssSSss.', '...gg...', '...h....', '...h....', '...H....', '...h....', '...h....', '...H....', '..ggg...', '...g....'] },
        whip: { grip: 9, rows: [
            '..rr.', '.rr..', 'rr...', '.rrr.', '...rr', '..rr.', '.rr..', 'rr...', '.rrr.', '..hh.', '..hH.', '..hh.', '.ggg.', '..g..'] },
        fist: { grip: 3, rows: [
            '.bbbbb.', 'bbaabbb', 'bbbbbbb', 'bbbbbbc', '.bbbcc.', '..ggg..', '..ggg..'] },
        boots: { grip: 3, rows: [
            '..bbbb.', '..bbab.', '..bbbc.', '.bbbbc.', 'bbbbbcc', 'SSSSSSS', '.......'] },
        bow: { grip: 8, rows: [
            '...hh.', '..h..w', '.h...w', '.h...w', 'h....w', 'h....w', 'h....w', 'g....w',
            'H....w', 'h....w', 'h....w', 'h....w', '.h...w', '.h...w', '..h..w', '...hh.'] },
        crossbow: { grip: 6, rows: [
            'h.......h', 'hh.....hh', '.hh...hh.', '..hhahhh.', '...SaS...', '...SbS...', '...hhh...', '...hHh...', '...HHH...'] },
        pistol: { grip: 7, rows: [
            '..SS..', '..Sa..', '..Sb..', '..SS..', '.SSSS.', '.SgSS.', '..hh..', '..hh..', '..HH..'] },
        shotgun: { grip: 11, rows: [
            '..S..', '.SaS.', '.SaS.', '.SbS.', '.SbS.', '.SSS.', '.SSS.', '.SSS.', '.gGg.', '.hhh.', '.hhh.', '.hHh.', '.hhh.', '..h..', '..H..', '..h..'] },
        wand: { grip: 10, rows: [
            '..a..', '.aaa.', 'aawaa', '.aba.', '..b..', '..h..', '..h..', '..H..', '..h..', '..h..', '.ggg.', '..H..', '..h..', '..g..'] },
        tome: { grip: 6, rows: [
            'kkkkkkkk', 'kbbbbbbk', 'kbaaaabk', 'kbawwabk', 'kbaaaabk', 'kbbbbbbk', 'kcccccck', 'kwwwwwwk', 'kkkkkkkk'] },
        twinblade: { grip: 8, rows: [
            'a.....a', 'aa...aa', 'ab...ba', 'ab...ba', 'ab...ba', 'abc.cba', '.gggggg', '..hGh..', '..hHh..', '...g...'] },
        chakram: { grip: 4, rows: [
            '..aaaaa..', '.aabbbaa.', 'aab...baa', 'ab.....ba', 'ab.....ba', 'ab.....bc', 'abb...bcc', '.abbbbcc.', '..ccccc..'] },
        cannon: { grip: 9, rows: [
            '..SSSS..', '.SaaaaS.', '.SaSSaS.', '.SaSSaS.', '.SbSSbS.', '.SbbbbS.', '.SSSSSS.', '.gGGGGg.', '..hhhh..', '..hHHh..', '...hh...', '..gggg..'] },
        esper: { grip: 3, rows: [
            '..aaa..', '.aaaaa.', 'aawwaab', 'aawaabb', '.abbbb.', '..bbc..', '...c...'] },
        kusarigama: { grip: 10, rows: [
            '.aaaa..', 'aabbba.', 'ab..abc', 'a....bc', '..S....', '..S.hh.', '...S.h.', '..S..H.', '...S.h.', '..S..h.', '.....h.', '.....H.', '....ggg', '.....g.'] },
        supportstaff: { grip: 12, rows: [
            '..ggg..', '.gaaag.', '.gawag.', '.gaaag.', '..ggg..', '..hhh..', '...h...', '...H...', '...h...', '...h...', '...h...', '...H...', '..ggg..', '...h...', '...H...', '...g...'] }
    };
    WEAPONS.default = WEAPONS.sword;

    // ---------- 敵（正面〜右向き。左向きは反転）----------
    const ENEMIES = {
        chaser: [
            '....kkkkkk....',
            '..kkmmmmmmkk..',
            '.kmmLLLmmmmmk.',
            '.kmLLmmmmmmmk.',
            'kmmLmmmmmmmmmk',
            'kmmmmmmmmmmmmk',
            'kmmwwkmmwwkmmk',
            'kmmwekmmwekmmk',
            'kmmmmmmmmmmmmk',
            'kMmmmkkkkmmmMk',
            'kMMmmkwkwkmmMk',
            '.kMMMMMMMMMMk.',
            '..kkMMMMMMkk..',
            '....kkkkkk....'],
        charger: [
            '.k..........k.',
            'kwk........kwk',
            'kwkk......kkwk',
            '.kmkkkkkkkkmk.',
            '..kmmmmmmmmk..',
            '.kmLLmmmmmmmk.',
            'kmmLmmmmmmmmmk',
            'kmmmmwwmwwmmmk',
            'kmmmmwemwemmmk',
            'kmmmmmmmmmmmMk',
            '.kMmmmwmwmmMk.',
            '..kMMmwkwmMk..',
            '...kkMMMMkk...',
            '....kk..kk....'],
        ranged: [
            '.....kkkk.....',
            '...kkLLLLkk...',
            '..kLLmmmmmmk..',
            '.kLmmmwwwmmmk.',
            '.kmmmwyyywmmk.',
            '.kmmmwykywmmk.',
            '.kmmmmwwwmmMk.',
            '..kmmmmmmMMk..',
            '...kkMMMMkk...',
            '..k.kMkMkMk.k.',
            '.k..k.k.k.k..k',
            '.k...k...k...k'],
        tank: [
            '..kkkkkkkkkk..',
            '.kMMMMMMMMMMk.',
            '.kMLLLmmmmmMk.',
            '.kMmmmmmmmmMk.',
            '.kMmkkmmkkmMk.',
            '.kMmyymmyymMk.',
            'kkMMMMMMMMMMkk',
            'kmmMmmmmmmMmmk',
            'kmmMmLLLLmMmmk',
            'kkkMmmmmmmMkkk',
            '..kMMkkkkMMk..',
            '..kmmk..kmmk..',
            '..kkkk..kkkk..',
            '..............'],
        swarm: [
            'kk........kk..',
            'kmkk.kk.kkmk..',
            'kmmmkmmkmmmk..',
            '.kmmmmmmmmk...',
            '..kmwemwemk...',
            '...kmmmmmk....',
            '....k.kk.k....',
            '..............'],
        bomber: [
            '.......y.y....',
            '......kyk.....',
            '.....kk.......',
            '....kkkk......',
            '..kkMMMMkk....',
            '.kMLLmmmmMk...',
            '.kMLmmmmmMk...',
            'kMmmmmmmmmMk..',
            'kMmwwmmwwmMk..',
            'kMmwewmwewmk..',
            'kMmmmmmmmmMk..',
            '.kMmmrrmmMk...',
            '.kMMmmmmMMk...',
            '..kkMMMMkk....']
    };
    ENEMIES.default = ENEMIES.chaser;


    // ---------- アバターの部品（10×16。上から重ねて合成する）----------
    //  y=その部品を置く行。'.' は下の絵をそのまま残す。髪は目より前、アクセサリーは最後に重ねる。
    const AV = {
        head: { y: 2, rows: ['...kkkk...', '..kssssk..', '.ksssssSk.', '.kssssssk.', '.ksssseSk.', '..kssssk..', '...kssk...'] },
        hair: {
            short:    { y: 2, rows: ['..........', '..khhhhk..', '.khhhhhhk.', '.khhh.....', '.khh......', '..kh......'] },
            long:     { y: 2, rows: ['..........', '..khhhhk..', '.khhhhhhk.', '.khhh.....', '.khh......', '.khh......', '.khh......', '.khh......', '.khh......', '.kh.......', '..k.......'] },
            spiky:    { y: 0, rows: ['.h..h..h..', '.hhhhhhhh.', '.khhhhhhk.', '.khhhhhhk.', '.khhh.....', '.khh......', '..kh......'] },
            curly:    { y: 1, rows: ['..hhhhhh..', '.hhhhhhhh.', 'hhhhhhhhhh', 'hhhhh.....', 'hhhh......', '.hhh......', '..hh......'] },
            bald:     { y: 2, rows: [] },
            ponytail: { y: 2, rows: ['..........', '..khhhhk..', '.khhhhhhk.', '.khhh.....', '.khh......', 'hhkh......', 'hhk.......', 'hhh.......', '.hh.......'] }
        },
        // 服：torso は y=9 から5行。legs はローブのように足まで隠すとき。pal は服の色
        outfit: {
            school_uniform: { rows: ['..kcwrwck.', '.kcclrcck.', '.kscclrck.', '.kscccCCk.', '..kcccCCk.'], pal: { c: '#2f3f77', C: '#1f2a52', l: '#4a5ea8', w: '#ffffff', r: '#d83a3a' } },
            casual:         { rows: ['..kcccck..', '.kccllcck.', '.ksccllck.', '.ksccccCk.', '..kccccCk.'], pal: { c: '#2aa198', C: '#1b7068', l: '#5fd0c4' } },
            armor:          { rows: ['..kaaaak..', '.kaAggAak.', '.kAaggaAk.', '.kAaaaaAk.', '..kgggggk.'], pal: { a: '#aab2c0', A: '#6b7384', g: '#f2c14e' } },
            robe:           { rows: ['..kcccck..', '.kcgllgck.', '.kcccccCk.', 'kcccgcccCk', 'kcccccccCk'], legs: ['.kcccccCk.', '..kkkkkk..'], pal: { c: '#6b3fa0', C: '#47287a', l: '#9a6ad8', g: '#f2c14e' } },
            sport:          { rows: ['..kcccck..', '.kwwwwwwk.', '.kscccwck.', '.ksccccCk.', '..kccccCk.'], pal: { c: '#d8433a', C: '#9a2a24', l: '#ff7a70', w: '#ffffff' } }
        },
        acc: {
            glasses:   { y: 5, rows: ['.....GGG..', '.....GeGG.', '.....GGG..'] },
            hat:       { y: 1, rows: ['..krrrrk..', '..krwwrk..', '.kkkkkkkk.'] },
            headband:  { y: 4, rows: ['rkrrrrrrk.', '.r........'] },
            earrings:  { y: 7, rows: ['........g.'] }
        }
    };

    // ---------- ボス（20×20）。色は敵ごとの色に差し替わる。p=光る色 ----------
    const BOSSES = {
        dragon: [
            '...k....kkkk....k...', '..kMk..kmmmmk..kMk..', '.kMMk.kmLLLmmk.kMMk.', 'kMMMMkmLwmmwLmkMMMMk',
            'kMMMMkmmeLLemmkMMMMk', '.kMMMkmmmmmmmmkMMMk.', '..kMMkmmkwwkmmkMMk..', '..kMMkkmmmmmmkkMMk..',
            '...kMMkmmmmmmkMMk...', '...kMMMkmLLmkMMMk...', '....kMMkmmmmkMMk....', '....kMMmmLLmmMMk....',
            '.....kmmmmmmmmk.....', '.....kmmLmmLmmk.....', '.....kmmmmmmmmk.....', '....kmmkmmmmkmmk....',
            '....kmk.kmmk.kmk....', '...kwwk.kmmk.kwwk...', '...kkk...kk...kkk...', '....................'],
        demon: [
            '..k..............k..', '.kMk............kMk.', '.kMMk..kkkkkk..kMMk.', '..kMMkkmmmmmmkkMMk..',
            '..kMMkmLLmmLLmkMMk..', '.kMMMkmwemmewmkMMMk.', '.kMMMkmmmwwmmmkMMMk.', 'kMMMMMkmmkkmmkMMMMMk',
            'kMMMMMkkmmmmkkMMMMMk', '.kMMMMkmmLLmmkMMMMk.', '..kMMMkmmmmmmkMMMk..', '...kMMkkmmmmkkMMk...',
            '....kkkmmLLmmkkk....', '.....kmmmmmmmmk.....', '.....kmmkkkkmmk.....', '.....kmmk..kmmk.....',
            '.....kmmk..kmmk.....', '....kmmmk..kmmmk....', '....kkkkk..kkkkk....', '....................'],
        golem: [
            '....kkkkkkkkkkkk....', '...kMMMMMMMMMMMMk...', '...kMLLLmmmmmmmMk...', '...kMLmmmmmmmmmMk...',
            '...kMmmkkmmkkmmMk...', '...kMmmyymmyymmMk...', '...kMmmmmmmmmmmMk...', '.kkkMMMMMMMMMMMMkkk.',
            'kmmmkMLLLLLmmmmkmmmk', 'kmLmkMLmmmmmmmmkmLmk', 'kmmmkMmmmmmmmmMkmmmk', 'kmmmkMmmmkkmmmMkmmmk',
            'kkkkkMmmmkkmmmMkkkkk', '...kMMMMMMMMMMMMk...', '...kMmmmk..kmmmMk...', '...kMmmmk..kmmmMk...',
            '...kMmmmk..kmmmMk...', '..kkMMMMk..kMMMMkk..', '..kkkkkkk..kkkkkkk..', '....................'],
        knight: [
            '.......kkkk.........', '......kssssk........', '.....kssLLssk.......', '.....ksSyySsk....kk.',
            '.....kssSSssk...kaak', '......kssssk...kaaak', '....kkkssssk..kaabk.', '...kssskmmmkkkkabk..',
            '..kssLskmmmmk.kk....', '..ksLsskmLmmk.kh....', '..kssskkmmmmkkkh....', '..kskkkmmmmmmk.kh...',
            '...kk.kmmmmmmk.kh...', '......kMmmmmMk.kh...', '......kMmkkmMk.kh...', '......kmmk.kmmk.kg..',
            '.....kmmmk.kmmmk.k..', '.....kSSSk.kSSSk....', '.....kkkkk.kkkkk....', '....................'],
        mage: [
            '.......kkkk.........', '.....kkmmmmkk.......', '....kmmLLLmmmk......', '...kmmLmmmmmmk......',
            '...kmmmkkkkmmk......', '...kmmkppppkmmk.....', '...kmmkpeepkmmk.....', '...kmmmkppkmmmk.....',
            '....kmmmkkmmmmk..kg.', '...kMmmmmmmmmmMk.kpk', '..kMMmmLmmmmLmMMk.kk', '..kMMmmmmmmmmmMMk.kh',
            '..kMMmmmmmmmmmMMk.kh', '.kMMMmmLmmmmLmmMMMkh', '.kMMMmmmmmmmmmmMMMkh', '.kMMMMmmmmmmmmMMMMkh',
            '..kMMMMMMMMMMMMMMk.h', '..kkMMMMMMMMMMMMkk.h', '....kkkkkkkkkkkk..gg', '....................'],
        beast: [
            '....................', '..k..k..............', '.kmk.kmk............', '.kmmkmmmkkkk........',
            'kmmmmmmmmmmmkk......', 'kmwemmmmmmmmmkk.....', 'kmmmmmmmmmmmmmkk....', '.kkmwwwmmmmmmmmk..k.',
            '...kkkkmmLLmmmmmkkMk', '.....kmmmmmmmmmmmMMk', '.....kmmmmmmmmmMMMk.', '.....kMmmmmmmmMMMk..',
            '.....kMmkmmmkmMMk...', '.....kmmk.kmmkmmk...', '.....kmmk.kmmkmmk...', '....kmmmk.kmmmkmmk..',
            '....kkkkk.kkkkkkkk..', '....................', '....................', '....................'],
        kraken: [
            '......kkkkkkkk......', '....kkmmmmmmmmkk....', '...kmmLLLLmmmmmmk...', '..kmmLLmmmmmmmmmmk..',
            '.kmmLmmmmmmmmmmmmmk.', '.kmmmmwwmmmmwwmmmmk.', '.kmmmmwewmmwewmmmmk.', '.kmmmmmmmmmmmmmmmmk.',
            '..kmmmmmmMMmmmmmmk..', '...kMMmmmmmmmmMMk...', '..kMk.kMmmmmMk.kMk..', '.kMMk.kMMMMMMk.kMMk.',
            'kMMk..kMk..kMk..kMMk', 'kMk..kMMk..kMMk..kMk', 'kMMk.kMk....kMk.kMMk', '.kk..kk......kk..kk.',
            '....................', '....................', '....................', '....................'],
        reaper: [
            '......kkkkkkk.......', '....kkMMMMMMMkk.....', '...kMMMkkkkkMMMk....', '..kMMMkwwwwwkMMMk...',
            '..kMMkwwewewwkMMk...', '..kMMkwwwkwwwkMMk...', '..kMMMkwkwkwkMMMk...', '...kMMMkkkkkMMMk....',
            '....kMMMMMMMMMk.....', '...kMMmmMMMMmmMk....', '..kMMmmmMMMMmmmMk...', '..kMMmmmMMMMmmmMk...',
            '.kMMMmmmMMMMmmmMMk..', '.kMMMMMMMMMMMMMMMk..', '.kMMMMkMMMMMMkMMMk..', '..kkkkkMMMMMMkkkk...',
            '...kMMk......kMMk...', '...kkkk......kkkk...', '....................', '....................'],
        machine: [
            '.......kkkkkk.......', '......kssssssk......', '.....ksLLLLLSsk.....', '.....ksSkkkkSsk.....',
            '.....ksSyeeySsk.....', '.....ksSkkkkSsk.....', '......kssssssk......', '...kkkkkSSSSkkkkk...',
            '..kssSskssssksSssk..', '.kssLsSkmmmmkSsLssk.', '.kssssSkmyymkSssssk.', '.kssSSskmmmmksSSssk.',
            '..kkkkkksssskkkkkk..', '.....kSssssssSk.....', '.....kSsk..kSsk.....', '.....kSsk..kSsk.....',
            '....kSSSsk.kSSSsk...', '....kkkkkk.kkkkkk...', '....................', '....................'],
        angel: [
            '........kkkk........', '.......kLLLLk.......', '..kk..kLmmmmLk..kk..', '.kwwk.kmwkkwmk.kwwk.',
            'kwwwwkkmmmmmmkkwwwwk', 'kwwLwwkkmmmmkkwwLwwk', 'kwwwwwwkMmmMkwwwwwwk', '.kwwwwwkMmmMkwwwwwk.',
            '..kwwwwkMmmMkwwwwk..', '...kwwwkMmmMkwwwk...', '....kwwkMmmMkwwk....', '.....kkkMmmMkkk.....',
            '......kMMmmMMk......', '......kMmkkmMk......', '......kmmk.kmmk.....', '.....kkkk..kkkk.....',
            '....................', '....................', '....................', '....................'],
        orb: [
            '......kkkkkkkk......', '....kkLLLLLLLLkk....', '..kkLLmmmmmmmmLLkk..', '.kLLmmmwwwwwwmmmLLk.',
            '.kLmmmwwyyyywwmmmLk.', 'kLmmmwwyykkyywwmmmLk', 'kLmmmwwyykkyywwmmmLk', '.kLmmmwwyyyywwmmmLk.',
            '.kLLmmmwwwwwwmmmLLk.', '..kkLLmmmmmmmmLLkk..', '....kkMMMMMMMMkk....', '......kkkkkkkk......',
            '....................', '....................', '....................', '....................',
            '....................', '....................', '....................', '....................'],
        slime: [
            '.......kgkgk........', '......kggggk........', '.....kkkkkkkk.......', '....kmmmmmmmmmk.....',
            '...kmLLmmmmmmmmk....', '..kmLmmmmmmmmmmmk...', '..kmmmwwmmmwwmmmk...', '..kmmmwekmmwekmmk...',
            '..kmmmmmmmmmmmmmk...', '..kmmmkkkkkkkmmmk...', '..kMmmkwkwkwkmmMk...', '..kMMmmmmmmmmmMMk...',
            '...kMMMMMMMMMMMk....', '....kkkkkkkkkkk.....', '....................', '....................',
            '....................', '....................', '....................', '....................'],
        gate: [
            '...kkkkkkkkkkkkkk...', '..kMMMMMMMMMMMMMMk..', '.kMLLLLLLLLLLLLLLMk.', '.kMLkkkkkkkkkkkkLMk.',
            'kMMLkppppppppppkLMMk', 'kMmLkppwwwwwwppkLmMk', 'kMmLkpwwwwwwwwpkLmMk', 'kMmLkpwwwwwwwwpkLmMk',
            'kMmLkppwwwwwwppkLmMk', 'kMmLkppppwwppppkLmMk', 'kMmLkppppppppppkLmMk', 'kMmLkppppppppppkLmMk',
            'kMmLkppppppppppkLmMk', 'kMMLkppppppppppkLMMk', 'kkkkkkkkkkkkkkkkkkkk', '....................',
            '....................', '....................', '....................', '....................']
    };
    // 名前やアイコンから、どの絵を使うか決める（上から順に当てはまったもの）
    const BOSS_KIND_RULES = [
        [/ゲートキーパー|ガーディアン|門|番人|🚪|⛩|🕳/, 'gate'],
        [/グリム|リーパー|伯爵|💀|🧛/, 'reaper'],
        [/クラーケン|鯨|リヴァイアサン|ケートス|🐙|🐋/, 'kraken'],
        [/ドラゴン|竜|ヨルムンガンド|ドレイク|バハムート|ティアマト|🐉|🐲/, 'dragon'],
        [/ルシフェル|悪魔|魔王|デーモン|ディアブロ|インプ|ロード|タイラント|魔神|😈|👿|👹/, 'demon'],
        [/ゴーレム|トロール|巨神|巨人|タイタン|ブラスト|グラビトン|🗿|🥶|🌟|♨/, 'golem'],
        [/フェンリル|ケルベロス|スフィンクス|🐺|🐕|🦁/, 'beast'],
        [/メカ|マキナ|サイバー|ギア|オートマ|グラディエーター|スチーム|機|🤖|⚙|🏭|🧿|⚔/, 'machine'],
        [/天使|ケルビム|メタトロン|アルカディア|ゼウス|ガルーダ|セレスティアル|😇|☀|⚡|🌠/, 'angel'],
        [/魔女|司祭|巫女|禁書|プロメテウス|🧙|🔮|📕|📖/, 'mage'],
        [/スライム|🫧|🪱|サンドワーム/, 'slime'],
        [/将軍|戦将|ゴブリン|オーク|ヘパイストス|王|👑|🪓|🔨|🤴/, 'knight']
    ];
    BOSS_KIND_RULES.default = 'orb';


    // ---------- 神話の武器（専用のドット絵。上向き。a/b/c/d=その武器の色の 明/中/暗/最暗、w=白、g/G=金、k=ふち、h/H=木、s/S=鉄、r=赤）----------
    const MYTHIC_WEAPONS = {
        eternal_serenity: { grip: 19, rows: [
            '.....aa.....', '....aaaa....', '....aawa....', '...aaawab...', '...aaawab...', '...aaawab...', '...aaawbb...', '...aaawbb...',
            '...aaawbb...', '...aaawbb...', '...aabwbc...', '...aabwbc...', '..kaabwbck..', 'g..kabwbck.g', 'ggGgggggggGg', 'gGg.GwwG.gGg', '.g..kGggGk.g', '....khhhhk..',
            '.....hHhh...', '.....hwhh...', '.....hHhh...', '....GggggG..', '.....gwwg...'] },
        twin_sirius: { grip: 15, rows: [
            'a..........a', 'aa........aa', 'awa......awa', 'aaw......waa', 'baaw....waab', 'bbaaw..waabb', '.bbaawwwaab.', '.cbbaawaabbc',
            '..cbbbwbbbc.', '..ccbbwbbc..', '...ccbwbc...', '....kggGk...', '....kGggk...', '...kghhhgk..', '....hHHhH...', '....hwwhh...', '.....GGG....', '.....ggg....'] },
        orbit: { grip: 21, orbiters: 3, rows: [
            '.......aa.....', '......aaab....', '.....aaabb....', '.....aawbb....', '....aaawbbc...', '....aabwbbc...', '....aabwbc....', '....aabwbc....',
            '...aabbwbc....', '...abbbwcc....', '...abbcwc.....', '...abccwc.....', '....cccgg.....', '.....gGggg....', '.....GwwG.....', '.....ghhg.....', '.....hHhh.....', '.....hhhh.....', '.....hHhh.....',
            '.....hhhh.....', '.....hHhh.....', '....GgggGg....', '.....hhhh.....', '.....hHhh.....', '.....hhhh.....', '....GggggG....', '.....gwwg.....', '......gg......'] },
        grandia: { grip: 17, rows: [
            '.....aa.....', '....aaaa....', '...aaawab...', '...aaawab...', '..aaaawabb..', '..aaaawabb..', '..aaaawabb..', '..aaaawabb..',
            '..aaabwbbb..', '..aabbwbbc..', '..aabbwbbc..', '..abbbwbcc..', '..abbbwbcc..', 'g.kbbbwbcckg', 'GgGgggggggGg', 'gGgGGwwGGgGg', '.g.kGggGk.g.', '....khhhhk..', '.....hHhh...', '.....hHhh...', '.....hwhh...', '....gGggGg..', '....GggggG..'] },
        muMyou_katana: { grip: 18, rows: [
            '......a', '.....aa', '.....ab', '....aab', '....aab', '....abb', '...aabr', '...aabr', '...abbr', '...abbr', '..aabbr', '..aabcr', '..abbcr', '..abbcr', '.aabbcr', '.abbccr', '.abccdr', '..gGgGg', '...kwwk', '...hHhk', '...kHhk', '...hHhk', '...kHhk', '...hHhk', '...GggG', '....gg.'] },
        brionac: { grip: 21, rows: [
            'a....aa....a', 'aa...aa...aa', 'aaa..aaa.aaa', 'abaa.aaa.aab', 'abbaaaaaaabb', '.abbbaaabbb.', '..abbbwbbb..', '...abbwbb...', '....abwb....', '....gGwGg...', '....GgggG...', '.....hhh....', '.....hHh....', '.....hhh....', '.....hHh....',
            '.....hhh....', '.....hHh....', '.....hhh....', '.....hHh....', '.....hhh....', '.....hHh....', '....GgggG...', '.....gwg....', '......g.....'] },
        freikugel: { grip: 11, rows: [
            '....kk....', '...kaak...', '...kwwk...', '...kSSk...', '...kSsk...', '...kSsk...', '..kSSSSk..', '.kgSbbSgk.', '.kgSbwSgk.', '.kgSbbSgk.', '..kGggGk..', '...kHhk...', '...khhk...', '...kHhk...', '...khhk...', '...kGgk...', '....kk....'] },
        asura_fist: { grip: 8, rows: [
            '.a.a.a.a....', 'abaabaabaab.', 'bbbcbbcbbcbc', 'bbwcbwcbwcbc', 'bbbcbbcbbcbc', 'bbbbbbbbbbcc', '.bbbbbbbbbc.', '.abbbbbbbc..', '..gggggggg..', '..gGgGgGgg..', '..GgwwwwgG..', '...gGGGGg...', '....GggG....', '.....GG.....'] },
        thanatos: { grip: 20, rows: [
            '...aaaaaaaa..', '..aabbbbbbaa.', '.aabbaaaabbaa', 'aabba....abba', 'abba......abb', 'abb........bc', 'ab..........c', 'a....gGg.....', '.....GwG.....', '.....gGg.....', '.....hhh.....', '.....hHh.....', '.....hhh.....', '.....hHh.....', '.....hhh.....',
            '.....hHh.....', '.....hhh.....', '.....hHh.....', '.....hhh.....', '.....hHh.....', '....GgggG....', '.....hhh.....', '.....hHh.....', '.....GgG.....', '......g......'] },
        artemis: { grip: 11, rows: [
            '.....aa.....', '....aabb....', '...aabbcw...', '..aabcc.w...', '.aabcc..w...', '.abbc...w...', 'aabc....w...', 'abc.....w...', 'abc.....w...', 'abgGg...w...', 'abgwG...w...', 'abgGg...w...', 'abc.....w...', 'abc.....w...', 'aabc....w...', '.abbc...w...', '.aabcc..w...', '..aabcc.w...', '...aabbcw...', '....aabb....', '.....aa.....'] },
        yggdrasil: { grip: 15, rows: [
            '..a.a..a.a..', '.aaa.aaaaaa.', 'aabaaabbbaaa', '.aabbbwwbbaa', '..abbwwwwba.', '..aabwwwbaa.', '.a.aabwbaa.a', '..a..hbh..a.', '.....hhh....', '....hHhh....', '.....hhH....', '....hhhh....', '.....hHh....', '....hhhh....', '.....hhh....', '.....hHh....', '....hhhh....', '.....hhH....', '.....hHh....', '....GgggG...', '.....hhh....', '.....hHh....', '......g.....'] }
    };
    // 薙刀オルビット：光の輪が刃のまわりを回る（輪は別のコマで描く用）

    window.SBPIX_DATA = { BODY_TOP: BODY_TOP, LEGS: LEGS, WEAPONS: WEAPONS, ENEMIES: ENEMIES, AV: AV, BOSSES: BOSSES, BOSS_KIND_RULES: BOSS_KIND_RULES, MYTHIC_WEAPONS: MYTHIC_WEAPONS };
})();
