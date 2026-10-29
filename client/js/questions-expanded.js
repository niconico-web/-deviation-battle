// ============================================
// 拡張問題データベース
// 理科・社会・国語の問題を追加し、解説・ヒント・タグ機能を拡張
// ============================================

const EXPANDED_QUESTIONS = {
    // ============================================
    // 理科
    // ============================================
    "science": {
        "elementary": {
            "1": {
                "basic": [
                    {
                        "id": "sci_e1_1",
                        "question": "太陽が出ているのは朝と昼だけですか？",
                        "answer": "いいえ",
                        "explanation": "太陽は常に輝いていますが、地球が自転しているため、夜は地球の裏側になります。",
                        "hint": "地球は回っています",
                        "tags": ["太陽", "地球の自転"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_e1_2",
                        "question": "水は0度で凍ります。100度でどうなりますか？",
                        "answer": "沸騰する",
                        "explanation": "水は100度で沸騰して水蒸気になります。",
                        "hint": "お湯がわく",
                        "tags": ["水", "温度"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_e1_3",
                        "question": "植物は光合成で何を作りますか？",
                        "answer": "でんぷん",
                        "explanation": "植物は光合成で二酸化炭素と水からでんぷんと酸素を作ります。",
                        "hint": "エネルギー源",
                        "tags": ["植物", "光合成"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_e1_4",
                        "question": "魚は何で呼吸しますか？",
                        "answer": "えら",
                        "explanation": "魚はえらを使って水中の酸素を取り込みます。",
                        "hint": "首元についている",
                        "tags": ["魚", "呼吸"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_e1_5",
                        "question": "磁石のN極とS極はどうなりますか？",
                        "answer": "引き合う",
                        "explanation": "異なる極（NとS）は引き合い、同じ極（NとN、SとS）は反発します。",
                        "hint": "ちがうはな",
                        "tags": ["磁石"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "sci_e1_s1",
                        "question": "月はいつも同じ面を地球に向けています。これを何と言いますか？",
                        "answer": "潮汐固定",
                        "explanation": "月の自転周期と公転周期が同じであるため、いつも同じ面を地球に向けています。",
                        "hint": "月の回転",
                        "tags": ["月", "自転"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "sci_e1_s2",
                        "question": "氷が水に変わるとき、体積はどうなりますか？",
                        "answer": "増える",
                        "explanation": "水は凍ると体積が約9%増えます。これが氷が水に浮く理由です。",
                        "hint": "水に浮く",
                        "tags": ["水", "氷"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "sci_e1_a1",
                        "question": "空気中には約21%含まれている気体は何ですか？",
                        "answer": "酸素",
                        "explanation": "空気は窒素約78%、酸素約21%、その他約1%で構成されています。",
                        "hint": "呼吸に必要",
                        "tags": ["空気", "気体"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "2": {
                "basic": [
                    {
                        "id": "sci_e2_1",
                        "question": "動物の分類で、母乳で育てる動物のグループは何ですか？",
                        "answer": "哺乳類",
                        "explanation": "哺乳類は母乳で子を育て、胎生で子供を産む特徴があります。",
                        "hint": "ほにゅう",
                        "tags": ["動物", "分類"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_e2_2",
                        "question": "電流の単位は何ですか？",
                        "answer": "アンペア",
                        "explanation": "電流の単位はアンペア（A）です。",
                        "hint": "A",
                        "tags": ["電気", "単位"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_e2_3",
                        "question": "カエルの成長順序はどうなりますか？（卵→？→カエル）",
                        "answer": "おたまじゃくし",
                        "explanation": "カエルは卵→おたまじゃくし→カエルへと成長します（変態）。",
                        "hint": "尾がある",
                        "tags": ["カエル", "成長"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "sci_e2_s1",
                        "question": "光はどのような速さで進みますか？",
                        "answer": "約30万km/s",
                        "explanation": "光の速さは真空中で約30万km/s（秒速30万キロメートル）です。",
                        "hint": "とても速い",
                        "tags": ["光", "速さ"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "sci_e2_s2",
                        "question": "火山が噴火するときに出てくる溶けた岩石は何ですか？",
                        "answer": "マグマ",
                        "explanation": "地下の溶けた岩石をマグマ、地表に出たものを溶岩と言います。",
                        "hint": "地下の",
                        "tags": ["火山", "マグマ"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "sci_e2_a1",
                        "question": "植物が光合成を行うために必要な3つの要素は何ですか？（光、水、？）",
                        "answer": "二酸化炭素",
                        "explanation": "光合成には光、水、二酸化炭素が必要です。",
                        "hint": "呼吸で出す",
                        "tags": ["植物", "光合成"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "3": {
                "basic": [
                    {
                        "id": "sci_e3_1",
                        "question": "地球の内部は3つの層に分かれています。一番外側は何ですか？",
                        "answer": "地殻",
                        "explanation": "地球は外側から地殻、マントル、核の3層で構成されています。",
                        "hint": "表面",
                        "tags": ["地球", "構造"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_e3_2",
                        "question": "星の明るさを表す単位は何ですか？",
                        "answer": "等級",
                        "explanation": "星の明るさを等級で表します。数字が小さいほど明るいです。",
                        "hint": "明るさ",
                        "tags": ["星", "等級"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_e3_3",
                        "question": "風はどこからどこへ吹きますか？",
                        "answer": "高気圧から低気圧",
                        "explanation": "風は気圧の高いところから低いところへ吹きます。",
                        "hint": "気圧の差",
                        "tags": ["風", "気圧"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "sci_e3_s1",
                        "question": "光の三原色は何ですか？（3つ答えて）",
                        "answer": "赤青緑",
                        "explanation": "光の三原色は赤、青、緑です。これらを混ぜると白になります。",
                        "hint": "RGB",
                        "tags": ["光", "色"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "sci_e3_s2",
                        "question": "音の速さは何によって変わりますか？",
                        "answer": "温度",
                        "explanation": "音の速さは温度が高いほど速くなります。空気中では約340m/sです。",
                        "hint": "暑いと",
                        "tags": ["音", "速さ"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "sci_e3_a1",
                        "question": "惑星の中で最も大きいのは何ですか？",
                        "answer": "木星",
                        "explanation": "太陽系の惑星で最も大きいのは木星です。地球の約11倍の直径があります。",
                        "hint": "巨大な",
                        "tags": ["惑星", "太陽系"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "4": {
                "basic": [
                    {
                        "id": "sci_e4_1",
                        "question": "水溶液が酸性かアルカリ性かを調べるのに使う紙は何ですか？",
                        "answer": "リトマス紙",
                        "explanation": "リトマス紙は酸性で赤、アルカリ性で青に変色します。",
                        "hint": "色が変わる",
                        "tags": ["水溶液", "リトマス紙"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_e4_2",
                        "question": "力を加えても形が変わらない物体の性質を何と言いますか？",
                        "answer": "弾性",
                        "explanation": "弾性は力を加えても元の形に戻る性質です。",
                        "hint": "ゴムボール",
                        "tags": ["力", "弾性"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_e4_3",
                        "question": "電気回路で電流の流れを止めるものは何ですか？",
                        "answer": "スイッチ",
                        "explanation": "スイッチは回路を開閉して電流の流れを制御します。",
                        "hint": "ON/OFF",
                        "tags": ["電気", "回路"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "sci_e4_s1",
                        "question": "物質が液体から気体に変わる現象を何と言いますか？",
                        "answer": "蒸発",
                        "explanation": "液体が気体に変わる現象を蒸発、気体が液体に変わる現象を凝縮と言います。",
                        "hint": "水が水蒸気に",
                        "tags": ["状態変化", "蒸発"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "sci_e4_s2",
                        "question": "生物のエネルギー源として使われる物質は何ですか？",
                        "answer": "でんぷん",
                        "explanation": "でんぷんは植物が光合成で作り、生物の主要なエネルギー源となります。",
                        "hint": "ご飯など",
                        "tags": ["栄養", "でんぷん"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "sci_e4_a1",
                        "question": "仕事の単位は何ですか？",
                        "answer": "ジュール",
                        "explanation": "仕事の単位はジュール（J）です。力×距離で計算されます。",
                        "hint": "J",
                        "tags": ["仕事", "単位"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "5": {
                "basic": [
                    {
                        "id": "sci_e5_1",
                        "question": "原子を構成する粒子のうち、電気的に中性なものは何ですか？",
                        "answer": "中性子",
                        "explanation": "原子は陽子（+）、中性子（0）、電子（-）で構成されています。",
                        "hint": "電荷がない",
                        "tags": ["原子", "粒子"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_e5_2",
                        "question": "鏡に映った像と実物の左右はどうなりますか？",
                        "answer": "逆になる",
                        "explanation": "鏡は左右を反転させます（上下はそのまま）。",
                        "hint": "左右反転",
                        "tags": ["鏡", "反射"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_e5_3",
                        "question": "季節が変わる主な原因は何ですか？",
                        "answer": "地軸の傾き",
                        "explanation": "地球の地軸が約23.4度傾いているため、季節が生じます。",
                        "hint": "地球の傾き",
                        "tags": ["季節", "地軸"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "sci_e5_s1",
                        "question": "pH7は酸性ですか、アルカリ性ですか、中性ですか？",
                        "answer": "中性",
                        "explanation": "pH7は中性です。7未満が酸性、7より大きいがアルカリ性です。",
                        "hint": "ちゅうせい",
                        "tags": ["pH", "酸性アルカリ性"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "sci_e5_s2",
                        "question": "重さと質量の違いは何ですか？",
                        "answer": "重さは重力による、質量は物質の量",
                        "explanation": "質量は物質そのものの量（変わらない）、重さは重力が働く力（場所で変わる）です。",
                        "hint": "場所で変わる",
                        "tags": ["重さ", "質量"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "sci_e5_a1",
                        "question": "慣性の法則は誰が発見しましたか？",
                        "answer": "ニュートン",
                        "explanation": "ニュートンの運動の第1法則（慣性の法則）です。",
                        "hint": "りんご",
                        "tags": ["慣性", "ニュートン"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "6": {
                "basic": [
                    {
                        "id": "sci_e6_1",
                        "question": "エネルギー保存の法則とは何ですか？",
                        "answer": "エネルギーは増えも減りもしない",
                        "explanation": "エネルギーは形を変えても、その総量は変わらないという法則です。",
                        "hint": "総量は一定",
                        "tags": ["エネルギー", "法則"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_e6_2",
                        "question": "遺伝情報を担っている物質は何ですか？",
                        "answer": "DNA",
                        "explanation": "DNA（デオキシリボ核酸）が遺伝情報を担っています。",
                        "hint": "でぃーえぬえー",
                        "tags": ["遺伝", "DNA"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_e6_3",
                        "question": "電圧の単位は何ですか？",
                        "answer": "ボルト",
                        "explanation": "電圧の単位はボルト（V）です。",
                        "hint": "V",
                        "tags": ["電気", "単位"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "sci_e6_s1",
                        "question": "植物の呼吸はいつ行われますか？",
                        "answer": "24時間",
                        "explanation": "植物は昼と夜の両方で呼吸を行います。昼は光合成も行います。",
                        "hint": "いつも",
                        "tags": ["植物", "呼吸"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "sci_e6_s2",
                        "question": "力のモーメント（回転の力）は何で決まりますか？",
                        "answer": "力と距離",
                        "explanation": "モーメント＝力×距離（支点からの距離）で決まります。",
                        "hint": "てこの原理",
                        "tags": ["力", "モーメント"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "sci_e6_a1",
                        "question": "相対性理論を提唱した科学者は誰ですか？",
                        "answer": "アインシュタイン",
                        "explanation": "アインシュタインが特殊相対性理論と一般相対性理論を提唱しました。",
                        "hint": "E=mc²",
                        "tags": ["相対性理論", "アインシュタイン"],
                        "difficulty": "advanced"
                    }
                ]
            }
        },
        "junior_high": {
            "1": {
                "basic": [
                    {
                        "id": "sci_j1_1",
                        "question": "光の屈折が起こるのはどういうときですか？",
                        "answer": "媒質が変わるとき",
                        "explanation": "光は異なる媒質（空気から水など）に入るときに屈折します。",
                        "hint": "水に入った光",
                        "tags": ["光", "屈折"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_j1_2",
                        "question": "元素記号Hは何の元素ですか？",
                        "answer": "水素",
                        "explanation": "Hは水素（Hydrogen）の元素記号です。",
                        "hint": "すいそ",
                        "tags": ["元素", "元素記号"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_j1_3",
                        "question": "生物の細胞の中心にある遺伝情報を制御する部分は何ですか？",
                        "answer": "核",
                        "explanation": "細胞核にDNAがあり、遺伝情報を制御しています。",
                        "hint": "DNAがある場所",
                        "tags": ["細胞", "核"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "sci_j1_s1",
                        "question": "加速度の単位は何ですか？",
                        "answer": "m/s²",
                        "explanation": "加速度の単位はメートル毎秒毎秒（m/s²）です。",
                        "hint": "速さの変化",
                        "tags": ["加速度", "単位"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "sci_j1_s2",
                        "question": "化学反応で反応物と生成物の質量はどうなりますか？",
                        "answer": "等しい",
                        "explanation": "質量保存の法則により、反応前後の質量は等しくなります。",
                        "hint": "質量保存",
                        "tags": ["化学反応", "質量保存"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "sci_j1_a1",
                        "question": "オームの法則の式は何ですか？",
                        "answer": "V=IR",
                        "explanation": "電圧V＝電流I×抵抗R（オームの法則）。",
                        "hint": "電圧と電流と抵抗",
                        "tags": ["電気", "オームの法則"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "2": {
                "basic": [
                    {
                        "id": "sci_j2_1",
                        "question": "酸化とは何ですか？",
                        "answer": "酸素と結合すること",
                        "explanation": "物質が酸素と結合する反応を酸化と言います。",
                        "hint": "さんそ",
                        "tags": ["化学反応", "酸化"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_j2_2",
                        "question": "力学的エネルギーは2種類に分けられます。何と何ですか？",
                        "answer": "運動エネルギーと位置エネルギー",
                        "explanation": "力学的エネルギー＝運動エネルギー＋位置エネルギーです。",
                        "hint": "動いていると高いところ",
                        "tags": ["エネルギー", "力学的エネルギー"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_j2_3",
                        "question": "金属元素の特徴は何ですか？",
                        "answer": "電気を通す",
                        "explanation": "金属は電気と熱をよく通す性質があります。",
                        "hint": "導体",
                        "tags": ["金属", "性質"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "sci_j2_s1",
                        "question": "圧力の単位は何ですか？",
                        "answer": "パスカル",
                        "explanation": "圧力の単位はパスカル（Pa）です。",
                        "hint": "Pa",
                        "tags": ["圧力", "単位"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "sci_j2_s2",
                        "question": "飽和水蒸気量とは何ですか？",
                        "answer": "空気が含める最大の水蒸気量",
                        "explanation": "その温度で空気が含める最大の水蒸気量です。温度が高いほど多くなります。",
                        "hint": "最大限",
                        "tags": ["水蒸気", "飽和"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "sci_j2_a1",
                        "question": "気体の状態方程式（理想気体の法則）は何ですか？",
                        "answer": "PV=nRT",
                        "explanation": "圧力P×体積V＝物質量n×気体定数R×絶対温度Tです。",
                        "hint": "PV",
                        "tags": ["気体", "状態方程式"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "3": {
                "basic": [
                    {
                        "id": "sci_j3_1",
                        "question": "イオンとは何ですか？",
                        "answer": "電荷を持った原子",
                        "explanation": "電子を失ったり得たりして電荷を持った原子や原子団です。",
                        "hint": "電荷がある",
                        "tags": ["イオン", "原子"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_j3_2",
                        "question": "電力の単位は何ですか？",
                        "answer": "ワット",
                        "explanation": "電力の単位はワット（W）です。電力＝電圧×電流。",
                        "hint": "W",
                        "tags": ["電力", "単位"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_j3_3",
                        "question": "動物の組織は主に何でできていますか？",
                        "answer": "細胞",
                        "explanation": "動物の体は細胞が集まって組織を作り、組織が集まって器官を作ります。",
                        "hint": "さいぼう",
                        "tags": ["動物", "細胞"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "sci_j3_s1",
                        "question": "密度の計算式は何ですか？",
                        "answer": "密度＝質量÷体積",
                        "explanation": "密度＝質量÷体積（ρ＝m/V）で計算します。",
                        "hint": "重さを大きさで割る",
                        "tags": ["密度", "計算"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "sci_j3_s2",
                        "question": "化学平衡とは何ですか？",
                        "answer": "正反応と逆反応の速度が等しい状態",
                        "explanation": "正反応と逆反応の速度が等しく、見かけ上反応が停止した状態です。",
                        "hint": "止まっているように見える",
                        "tags": ["化学反応", "平衡"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "sci_j3_a1",
                        "question": "核分裂反応で放出されるエネルギー源は何ですか？",
                        "answer": "質量欠損",
                        "explanation": "核分裂で質量が減少し、その質量がエネルギーに変換されます（E=mc²）。",
                        "hint": "質量がエネルギーに",
                        "tags": ["核分裂", "エネルギー"],
                        "difficulty": "advanced"
                    }
                ]
            }
        },
        "high_school": {
            "1": {
                "basic": [
                    {
                        "id": "sci_h1_1",
                        "question": "量子力学において、粒子の位置と運動量を同時に正確に知ることができない原理は何ですか？",
                        "answer": "不確定性原理",
                        "explanation": "ハイゼンベルクの不確定性原理：ΔxΔp≧ħ/2",
                        "hint": "ハイゼンベルク",
                        "tags": ["量子力学", "不確定性"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_h1_2",
                        "question": "有機化学で、炭素原子間の二重結合を何と言いますか？",
                        "answer": "アルケン",
                        "explanation": "炭素間の二重結合を持つ化合物をアルケンと言います。",
                        "hint": "二重結合",
                        "tags": ["有機化学", "アルケン"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_h1_3",
                        "question": "遺伝子の突然変異は何によって引き起こされますか？",
                        "answer": "DNAの変化",
                        "explanation": "DNAの塩基配列の変化や構造の変化が突然変異の原因です。",
                        "hint": "DNAの",
                        "tags": ["遺伝", "突然変異"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "sci_h1_s1",
                        "question": "エントロピー増大の法則とは何ですか？",
                        "answer": "孤立系のエントロピーは増大する",
                        "explanation": "熱力学第二法則：孤立系ではエントロピーが増大し、不可逆変化が起きます。",
                        "hint": "熱力学第二法則",
                        "tags": ["熱力学", "エントロピー"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "sci_h1_s2",
                        "question": "酸化還元反応で、電子を失う側を何と言いますか？",
                        "answer": "酸化剤",
                        "explanation": "電子を失う反応を酸化、得る反応を還元と言います。",
                        "hint": "電子を失う",
                        "tags": ["酸化還元", "化学反応"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "sci_h1_a1",
                        "question": "シュレーディンガー方程式は何を記述しますか？",
                        "answer": "量子系の時間発展",
                        "explanation": "シュレーディンガー方程式は量子系の状態の時間発展を記述します。",
                        "hint": "量子",
                        "tags": ["量子力学", "シュレーディンガー"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "2": {
                "basic": [
                    {
                        "id": "sci_h2_1",
                        "question": " Maxwellの方程式は何を記述しますか？",
                        "answer": "電磁場",
                        "explanation": "Maxwellの方程式は電場と磁場の関係を記述します。",
                        "hint": "電気と磁気",
                        "tags": ["電磁気", "Maxwell"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_h2_2",
                        "question": "タンパク質の一次構造は何で決まりますか？",
                        "answer": "アミノ酸配列",
                        "explanation": "タンパク質の一次構造はアミノ酸の配列で決まります。",
                        "hint": "アミノ酸の並び",
                        "tags": ["タンパク質", "構造"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_h2_3",
                        "question": "同位体とは何ですか？",
                        "answer": "原子番号が同じで質量数が異なる原子",
                        "explanation": "同じ元素で中性子数が異なる原子を同位体と言います。",
                        "hint": "質量数が違う",
                        "tags": ["原子", "同位体"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "sci_h2_s1",
                        "question": "ルシャトリエの原理とは何ですか？",
                        "answer": "平衡状態で条件を変えると、それを打ち消す方向に変化する",
                        "explanation": "化学平衡で外部条件を変えると、平衡がその影響を打ち消す方向に移動します。",
                        "hint": "平衡",
                        "tags": ["化学平衡", "ルシャトリエ"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "sci_h2_s2",
                        "question": "波動関数の絶対値の二乗は何を表しますか？",
                        "answer": "確率密度",
                        "explanation": "ボルンの解釈：|ψ|²は粒子を見つける確率密度を表します。",
                        "hint": "確率",
                        "tags": ["量子力学", "波動関数"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "sci_h2_a1",
                        "question": "一般相対性理論で重力は何として記述されますか？",
                        "answer": "時空の曲率",
                        "explanation": "一般相対性理論では重力を時空の曲率として記述します。",
                        "hint": "時空",
                        "tags": ["相対性理論", "重力"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "3": {
                "basic": [
                    {
                        "id": "sci_h3_1",
                        "question": "半減期とは何ですか？",
                        "answer": "放射性元素が半分に減る時間",
                        "explanation": "放射性元素の量が半分になるまでの時間です。",
                        "hint": "半分になる",
                        "tags": ["放射能", "半減期"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_h3_2",
                        "question": "酵素は何として働きますか？",
                        "answer": "触媒",
                        "explanation": "酵素は生体内の化学反応を加速する触媒として働きます。",
                        "hint": "反応を速くする",
                        "tags": ["酵素", "触媒"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "sci_h3_3",
                        "question": "分子軌道理論では、電子は何に入っていますか？",
                        "answer": "分子軌道",
                        "explanation": "分子軌道理論では、電子は原子軌道が重なってできた分子軌道に入ります。",
                        "hint": "分子の",
                        "tags": ["化学結合", "分子軌道"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "sci_h3_s1",
                        "question": "カルノサイクルの効率は何で決まりますか？",
                        "answer": "高温熱源と低温熱源の温度",
                        "explanation": "カルノ効率＝1－T低温/T高温で決まります。",
                        "hint": "温度差",
                        "tags": ["熱力学", "カルノ"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "sci_h3_s2",
                        "question": "DNAの二重らせん構造は誰が発見しましたか？",
                        "answer": "ワトソンとクリック",
                        "explanation": "1953年にワトソンとクリックがDNAの二重らせん構造を発見しました。",
                        "hint": "二人の科学者",
                        "tags": ["DNA", "発見者"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "sci_h3_a1",
                        "question": "ハッブルの法則は何を示していますか？",
                        "answer": "宇宙の膨張",
                        "explanation": "遠方の銀河ほど速く遠ざかることを示し、宇宙の膨張を証明しています。",
                        "hint": "宇宙が広がる",
                        "tags": ["宇宙", "ハッブル"],
                        "difficulty": "advanced"
                    }
                ]
            }
        }
    },

    // ============================================
    // 社会
    // ============================================
    "social": {
        "elementary": {
            "1": {
                "basic": [
                    {
                        "id": "soc_e1_1",
                        "question": "日本の首都はどこですか？",
                        "answer": "東京",
                        "explanation": "日本の首都は東京です。",
                        "hint": "とうきょう",
                        "tags": ["日本", "首都"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_e1_2",
                        "question": "日本の国旗は何と呼ばれますか？",
                        "answer": "日の丸",
                        "explanation": "日本の国旗は日の丸（日章旗）です。",
                        "hint": "まるい",
                        "tags": ["日本", "国旗"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_e1_3",
                        "question": "1年は何ヶ月ですか？",
                        "answer": "12",
                        "explanation": "1年は12ヶ月です。",
                        "hint": "じゅうに",
                        "tags": ["暦", "時間"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "soc_e1_s1",
                        "question": "日本の通貨の単位は何ですか？",
                        "answer": "円",
                        "explanation": "日本の通貨は円（¥）です。",
                        "hint": "えん",
                        "tags": ["日本", "通貨"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "soc_e1_s2",
                        "question": "地図上で北はどちらですか？",
                        "answer": "上",
                        "explanation": "一般的に地図の上が北です。",
                        "hint": "きた",
                        "tags": ["地図", "方位"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "soc_e1_a1",
                        "question": "世界で最も人口が多い国はどこですか？",
                        "answer": "中国",
                        "explanation": "中国は世界で最も人口が多い国です（約14億人）。",
                        "hint": "ちゅうごく",
                        "tags": ["世界", "人口"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "2": {
                "basic": [
                    {
                        "id": "soc_e2_1",
                        "question": "日本で使われている言葉は何ですか？",
                        "answer": "日本語",
                        "explanation": "日本の公用語は日本語です。",
                        "hint": "にほんご",
                        "tags": ["日本", "言語"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_e2_2",
                        "question": "7月は何ヶ月目ですか？",
                        "answer": "7",
                        "explanation": "7月は7ヶ月目です。",
                        "hint": "しちがつ",
                        "tags": ["暦", "月"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_e2_3",
                        "question": "学校で学ぶことを何と言いますか？",
                        "answer": "勉強",
                        "explanation": "学校で学ぶことを勉強や学習と言います。",
                        "hint": "べんきょう",
                        "tags": ["学校", "学習"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "soc_e2_s1",
                        "question": "日本の国花は何ですか？",
                        "answer": "桜と菊",
                        "explanation": "日本の国花は桜と菊です。",
                        "hint": "さくら",
                        "tags": ["日本", "花"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "soc_e2_s2",
                        "question": "大人は何歳からですか？",
                        "answer": "20歳",
                        "explanation": "日本では20歳から成人とみなされます。",
                        "hint": "はたち",
                        "tags": ["年齢", "成人"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "soc_e2_a1",
                        "question": "日本の面積は世界で何番目くらいですか？",
                        "answer": "60番目くらい",
                        "explanation": "日本の面積は約38万km²で、世界で約60番目です。",
                        "hint": "それほど大きくない",
                        "tags": ["日本", "面積"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "3": {
                "basic": [
                    {
                        "id": "soc_e3_1",
                        "question": "日本の国歌は何ですか？",
                        "answer": "君が代",
                        "explanation": "日本の国歌は君が代です。",
                        "hint": "きみがよ",
                        "tags": ["日本", "国歌"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_e3_2",
                        "question": "地図記号で「△」は何を表しますか？",
                        "answer": "三角点",
                        "explanation": "地図記号の△は三角点（測量の基準点）を表します。",
                        "hint": "さんかくてん",
                        "tags": ["地図", "記号"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_e3_3",
                        "question": "1時間は何分ですか？",
                        "answer": "60",
                        "explanation": "1時間は60分です。",
                        "hint": "ろくじゅっぷん",
                        "tags": ["時間", "単位"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "soc_e3_s1",
                        "question": "日本の四国には4つの県があります。そのうちの一つは香川県です。残り3つは？",
                        "answer": "徳島県愛媛県高知県",
                        "explanation": "四国は香川、徳島、愛媛、高知の4県です。",
                        "hint": "しこく",
                        "tags": ["日本", "四国"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "soc_e3_s2",
                        "question": "平成は何年から始まりましたか？",
                        "answer": "1989年",
                        "explanation": "平成は1989年から2019年まででした。",
                        "hint": "昭和の次",
                        "tags": ["日本", "元号"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "soc_e3_a1",
                        "question": "世界で最も面積が大きい国はどこですか？",
                        "answer": "ロシア",
                        "explanation": "ロシアは世界で最も面積が大きい国です（約1700万km²）。",
                        "hint": "おおきい",
                        "tags": ["世界", "面積"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "4": {
                "basic": [
                    {
                        "id": "soc_e4_1",
                        "question": "日本の首相は誰が決めますか？",
                        "answer": "国会",
                        "explanation": "首相は国会で指名され、天皇が任命します。",
                        "hint": "こっかい",
                        "tags": ["政治", "首相"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_e4_2",
                        "question": "選挙権は何歳からですか？",
                        "answer": "18歳",
                        "explanation": "日本では18歳から選挙権があります。",
                        "hint": "じゅうはっさい",
                        "tags": ["政治", "選挙"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_e4_3",
                        "question": "日本の法律を作る機関は何ですか？",
                        "answer": "国会",
                        "explanation": "国会が法律を作ります（立法権）。",
                        "hint": "りっぽうけん",
                        "tags": ["政治", "国会"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "soc_e4_s1",
                        "question": "日本の都道府県は全部でいくつですか？",
                        "answer": "47",
                        "explanation": "日本は1都1道2府43県の47都道府県です。",
                        "hint": "よんじゅうなな",
                        "tags": ["日本", "都道府県"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "soc_e4_s2",
                        "question": "日本の最高裁判所の長は何と呼ばれますか？",
                        "answer": "最高裁長官",
                        "explanation": "最高裁判所の長は最高裁長官です。",
                        "hint": "さいこうさいちょうかん",
                        "tags": ["司法", "裁判所"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "soc_e4_a1",
                        "question": "日本国憲法が制定されたのは何年ですか？",
                        "answer": "1947年",
                        "explanation": "日本国憲法は1947年5月3日に施行されました。",
                        "hint": "戦後",
                        "tags": ["日本", "憲法"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "5": {
                "basic": [
                    {
                        "id": "soc_e5_1",
                        "question": "日本の消費税は現在何％ですか？",
                        "answer": "10",
                        "explanation": "日本の消費税は10%です（2019年から）。",
                        "hint": "じゅっパーセント",
                        "tags": ["経済", "税金"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_e5_2",
                        "question": "日本の国の仕事をする場所はどこですか？",
                        "answer": "東京",
                        "explanation": "日本の国会や政府は東京にあります。",
                        "hint": "首都",
                        "tags": ["政治", "政府"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_e5_3",
                        "question": "日本で最も人口が多い都道府県はどこですか？",
                        "answer": "東京都",
                        "explanation": "東京都は日本で最も人口が多い都道府県です（約1400万人）。",
                        "hint": "とうきょうと",
                        "tags": ["日本", "人口"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "soc_e5_s1",
                        "question": "日本の三大都市はどこですか？",
                        "answer": "東京大阪名古屋",
                        "explanation": "三大都市圏は東京、大阪、名古屋です。",
                        "hint": "大きい都市",
                        "tags": ["日本", "都市"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "soc_e5_s2",
                        "question": "日本の国旗「日の丸」の白い部分は何を表しますか？",
                        "answer": "平和と誠実",
                        "explanation": "白は平和と誠実、赤は太陽と情熱を表すと言われています。",
                        "hint": "しろ",
                        "tags": ["日本", "国旗"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "soc_e5_a1",
                        "question": "日本のGDPは世界で何番目ですか？",
                        "answer": "3番目",
                        "explanation": "日本のGDPは世界で第3位です（アメリカ、中国に次ぐ）。",
                        "hint": "上位",
                        "tags": ["経済", "GDP"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "6": {
                "basic": [
                    {
                        "id": "soc_e6_1",
                        "question": "日本の気候は主に何ですか？",
                        "answer": "温帯",
                        "explanation": "日本は温帯モンスーン気候です。",
                        "hint": "おんたい",
                        "tags": ["日本", "気候"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_e6_2",
                        "question": "日本で使われている文字は何種類ありますか？（ひらがな、カタカナ、漢字）",
                        "answer": "3",
                        "explanation": "ひらがな、カタカナ、漢字の3種類を使います。",
                        "hint": "さんしゅるい",
                        "tags": ["日本", "文字"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_e6_3",
                        "question": "日本の国土は約何％が山地ですか？",
                        "answer": "70",
                        "explanation": "日本の国土の約70%は山地です。",
                        "hint": "ななじゅっパーセント",
                        "tags": ["日本", "地形"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "soc_e6_s1",
                        "question": "日本の主要な輸出品は何ですか？",
                        "answer": "自動車",
                        "explanation": "自動車は日本の主要な輸出品です。",
                        "hint": "くるま",
                        "tags": ["経済", "貿易"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "soc_e6_s2",
                        "question": "日本の人口は約何人ですか？",
                        "answer": "1億2000万人",
                        "explanation": "日本の人口は約1億2000万人です。",
                        "hint": "いちおく",
                        "tags": ["日本", "人口"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "soc_e6_a1",
                        "question": "日本の平均寿命は世界で何番目ですか？",
                        "answer": "上位",
                        "explanation": "日本は世界で最も平均寿命が長い国の一つです。",
                        "hint": "ながい",
                        "tags": ["日本", "寿命"],
                        "difficulty": "advanced"
                    }
                ]
            }
        },
        "junior_high": {
            "1": {
                "basic": [
                    {
                        "id": "soc_j1_1",
                        "question": "奈良時代に作られた大きな仏像は何ですか？",
                        "answer": "大仏",
                        "explanation": "奈良の東大寺の大仏です。",
                        "hint": "なら",
                        "tags": ["歴史", "奈良時代"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_j1_2",
                        "question": "江戸時代に日本を統治したのは誰ですか？",
                        "answer": "将軍",
                        "explanation": "江戸幕府の将軍が日本を統治しました。",
                        "hint": "しょうぐん",
                        "tags": ["歴史", "江戸時代"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_j1_3",
                        "question": "日本の地形は主に何でできていますか？",
                        "answer": "山",
                        "explanation": "日本は山がちな地形です。",
                        "hint": "やま",
                        "tags": ["地理", "地形"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "soc_j1_s1",
                        "question": "平安時代に源氏と平氏が争った戦いは何ですか？",
                        "answer": "保元の乱と平治の乱",
                        "explanation": "保元の乱（1156年）と平治の乱（1159年）です。",
                        "hint": "げんぺい",
                        "tags": ["歴史", "平安時代"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "soc_j1_s2",
                        "question": "日本の川は短く急流なのはなぜですか？",
                        "answer": "山地が多いから",
                        "explanation": "山地が多く海までの距離が短いため、川は短く急流になります。",
                        "hint": "やまが多い",
                        "tags": ["地理", "川"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "soc_j1_a1",
                        "question": "聖徳太子が制定した憲法は何ですか？",
                        "answer": "十七条憲法",
                        "explanation": "聖徳太子が604年に十七条憲法を制定しました。",
                        "hint": "じゅうしちじょう",
                        "tags": ["歴史", "聖徳太子"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "2": {
                "basic": [
                    {
                        "id": "soc_j2_1",
                        "question": "明治維新で日本は何を目指しましたか？",
                        "answer": "近代化",
                        "explanation": "明治維新で日本は近代化と富国強兵を目指しました。",
                        "hint": "きんだいか",
                        "tags": ["歴史", "明治維新"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_j2_2",
                        "question": "日本の気候の特徴は何ですか？",
                        "answer": "四季がある",
                        "explanation": "日本は四季の変化が明確な気候です。",
                        "hint": "しき",
                        "tags": ["地理", "気候"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_j2_3",
                        "question": "世界で最初に民主主義的政治を行った国はどこですか？",
                        "answer": "ギリシャ",
                        "explanation": "古代ギリシャで民主主義が始まりました。",
                        "hint": "古代",
                        "tags": ["世界史", "民主主義"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "soc_j2_s1",
                        "question": "江戸時代に鎖国を解いたのは誰ですか？",
                        "answer": "ペリー",
                        "explanation": "1853年にペリーが来航し、日本は開国しました。",
                        "hint": "くろふね",
                        "tags": ["歴史", "開国"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "soc_j2_s2",
                        "question": "日本の雨が多い時期はいつですか？",
                        "answer": "梅雨",
                        "explanation": "6月〜7月の梅雨時期に雨が多くなります。",
                        "hint": "つゆ",
                        "tags": ["地理", "気候"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "soc_j2_a1",
                        "question": "第一次世界大戦は何年から何年まででしたか？",
                        "answer": "1914年から1918年",
                        "explanation": "第一次世界大戦は1914-1918年でした。",
                        "hint": "だいいちじ",
                        "tags": ["世界史", "世界大戦"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "3": {
                "basic": [
                    {
                        "id": "soc_j3_1",
                        "question": "第二次世界大戦は何年に終わりましたか？",
                        "answer": "1945年",
                        "explanation": "第二次世界大戦は1945年に終わりました。",
                        "hint": "せんそう",
                        "tags": ["歴史", "第二次世界大戦"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_j3_2",
                        "question": "日本の太平洋側と日本海側で気候が違うのはなぜですか？",
                        "answer": "山脈があるから",
                        "explanation": "中央の山脈が風を遮るため、太平洋側と日本海側で気候が異なります。",
                        "hint": "やま",
                        "tags": ["地理", "気候"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_j3_3",
                        "question": "国連が設立されたのは何年ですか？",
                        "answer": "1945年",
                        "explanation": "国連は1945年に設立されました。",
                        "hint": "せかい",
                        "tags": ["世界史", "国連"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "soc_j3_s1",
                        "question": "日本国憲法の三大原則は何ですか？",
                        "answer": "国民主権平和主義基本的人権",
                        "explanation": "国民主権、平和主義、基本的人権の尊重が三大原則です。",
                        "hint": "けんぽう",
                        "tags": ["政治", "憲法"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "soc_j3_s2",
                        "question": "日本の工業地帯はどこに集中していますか？",
                        "answer": "太平洋ベルト",
                        "explanation": "太平洋ベルト地帯に工業が集中しています。",
                        "hint": "たいへいよう",
                        "tags": ["経済", "工業"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "soc_j3_a1",
                        "question": "冷戦は何年から何年まででしたか？",
                        "answer": "1947年から1991年",
                        "explanation": "冷戦は1947年から1991年まででした。",
                        "hint": "アメリカとソ連",
                        "tags": ["世界史", "冷戦"],
                        "difficulty": "advanced"
                    }
                ]
            }
        },
        "high_school": {
            "1": {
                "basic": [
                    {
                        "id": "soc_h1_1",
                        "question": "資本主義経済の特徴は何ですか？",
                        "answer": "市場原理",
                        "explanation": "資本主義は市場原理（需要と供給）で資源を配分します。",
                        "hint": "しじょう",
                        "tags": ["経済", "資本主義"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_h1_2",
                        "question": "社会契約論を提唱した哲学者は誰ですか？",
                        "answer": "ルソー",
                        "explanation": "ルソーが社会契約論（『社会契約論』）を著しました。",
                        "hint": "18世紀",
                        "tags": ["政治哲学", "ルソー"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_h1_3",
                        "question": "マクロ経済学で、GDPとは何の略ですか？",
                        "answer": "国内総生産",
                        "explanation": "Gross Domestic Productの略です。",
                        "hint": "こくないそうせいさん",
                        "tags": ["経済", "GDP"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "soc_h1_s1",
                        "question": "デモクラシーの語源は何ですか？",
                        "answer": "ギリシャ語",
                        "explanation": "デモス（民衆）+クラトス（支配）から来ています。",
                        "hint": "古代ギリシャ",
                        "tags": ["政治", "民主主義"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "soc_h1_s2",
                        "question": "需要曲線は一般的にどのような形ですか？",
                        "answer": "右下がり",
                        "explanation": "価格が下がると需要が増えるため、右下がりの曲線になります。",
                        "hint": "さがる",
                        "tags": ["経済", "需要"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "soc_h1_a1",
                        "question": "ケインズ経済学の核心は何ですか？",
                        "answer": "有効需要の原理",
                        "explanation": "ケインズは有効需要が総生産を決めると主張しました。",
                        "hint": "ゆうこうじゅよう",
                        "tags": ["経済", "ケインズ"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "2": {
                "basic": [
                    {
                        "id": "soc_h2_1",
                        "question": "三権分立とは何ですか？",
                        "answer": "権力を3つに分ける",
                        "explanation": "立法権、行政権、司法権を分けて権力を抑制します。",
                        "hint": "けんりょく",
                        "tags": ["政治", "三権分立"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_h2_2",
                        "question": "貨幣の3つの機能は何ですか？",
                        "answer": "価値尺度流通手段価値貯蔵",
                        "explanation": "価値尺度、流通手段、価値貯蔵の3つの機能があります。",
                        "hint": "かへい",
                        "tags": ["経済", "貨幣"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_h2_3",
                        "question": "パックス・ブリタニカとは何ですか？",
                        "answer": "イギリスによる平和",
                        "explanation": "19世紀、イギリスの覇権下での平和状態を指します。",
                        "hint": "イギリス",
                        "tags": ["世界史", "パックス・ブリタニカ"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "soc_h2_s1",
                        "question": "国際連合の安全保障理事会の常任理事国は5カ国です。そのうちの一つは中国です。残り4つは？",
                        "answer": "アメリカイギリスフランスロシア",
                        "explanation": "米、英、仏、露、中の5カ国です。",
                        "hint": "P5",
                        "tags": ["国際政治", "国連"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "soc_h2_s2",
                        "question": "インフレーションとは何ですか？",
                        "answer": "物価が継続的に上昇",
                        "explanation": "貨幣価値が下がり、物価が上昇する現象です。",
                        "hint": "ぶっかがあがる",
                        "tags": ["経済", "インフレ"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "soc_h2_a1",
                        "question": "新古典派経済学の核心的な考え方は何ですか？",
                        "answer": "市場の完全競争",
                        "explanation": "市場は完全競争であれば最適な資源配分が達成されると考えます。",
                        "hint": "しじょう",
                        "tags": ["経済", "新古典派"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "3": {
                "basic": [
                    {
                        "id": "soc_h3_1",
                        "question": "明治憲法と現行憲法の最大の違いは何ですか？",
                        "answer": "天皇の地位",
                        "explanation": "明治憲法では天皇が主権者、現行憲法では象徴です。",
                        "hint": "てんのう",
                        "tags": ["政治", "憲法"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_h3_2",
                        "question": "為替相場とは何ですか？",
                        "answer": "通貨の交換比率",
                        "explanation": "異なる通貨間の交換比率です。",
                        "hint": "かわせ",
                        "tags": ["経済", "為替"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "soc_h3_3",
                        "question": "冷戦の終結を象徴する出来事は何ですか？",
                        "answer": "ベルリンの壁崩壊",
                        "explanation": "1989年のベルリンの壁崩壊が冷戦終結の象徴です。",
                        "hint": "1989",
                        "tags": ["世界史", "冷戦"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "soc_h3_s1",
                        "question": "財政政策の主な手段は何ですか？",
                        "answer": "税金と公共投資",
                        "explanation": "税制と公共投資を通じて経済を調整します。",
                        "hint": "ぜいせい",
                        "tags": ["経済", "財政政策"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "soc_h3_s2",
                        "question": "WTOとは何の略ですか？",
                        "answer": "世界貿易機関",
                        "explanation": "World Trade Organizationの略です。",
                        "hint": "せかいぼうえき",
                        "tags": ["国際経済", "WTO"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "soc_h3_a1",
                        "question": "パックス・アメリカーナとは何ですか？",
                        "answer": "アメリカによる平和",
                        "explanation": "第二次世界大戦後、アメリカの覇権下での平和状態を指します。",
                        "hint": "アメリカ",
                        "tags": ["世界史", "パックス・アメリカーナ"],
                        "difficulty": "advanced"
                    }
                ]
            }
        }
    },

    // ============================================
    // 国語
    // ============================================
    "japanese": {
        "elementary": {
            "1": {
                "basic": [
                    {
                        "id": "jp_e1_1",
                        "question": "「あいうえお」は何文字ですか？",
                        "answer": "5",
                        "explanation": "あいうえおは5文字です。",
                        "hint": "いつつ",
                        "tags": ["ひらがな", "文字"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_e1_2",
                        "question": "「りんご」は何種類の文字で書けますか？（ひらがな、カタカナ、漢字）",
                        "answer": "3",
                        "explanation": "りんご（ひらがな）、リンゴ（カタカナ）、林檎（漢字）の3種類です。",
                        "hint": "さんしゅ",
                        "tags": ["文字", "表記"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_e1_3",
                        "question": "「いぬ」は何ですか？",
                        "answer": "犬",
                        "explanation": "いぬは犬という漢字で書きます。",
                        "hint": "どうぶつ",
                        "tags": ["漢字", "動物"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "jp_e1_s1",
                        "question": "「おおきい」の反対は何ですか？",
                        "answer": "ちいさい",
                        "explanation": "大きいの反対は小さいです。",
                        "hint": "おおきい↔",
                        "tags": ["言葉", "反対語"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "jp_e1_s2",
                        "question": "「たのしい」の意味は何ですか？",
                        "answer": "楽しい",
                        "explanation": "楽しいとは、心が満たされて喜びを感じることです。",
                        "hint": "うれしい",
                        "tags": ["言葉", "意味"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "jp_e1_a1",
                        "question": "「まる」の漢字は何ですか？",
                        "answer": "丸",
                        "explanation": "まるは丸という漢字で書きます。",
                        "hint": "かたち",
                        "tags": ["漢字", "形"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "2": {
                "basic": [
                    {
                        "id": "jp_e2_1",
                        "question": "「ねこ」の漢字は何ですか？",
                        "answer": "猫",
                        "explanation": "ねこは猫という漢字で書きます。",
                        "hint": "どうぶつ",
                        "tags": ["漢字", "動物"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_e2_2",
                        "question": "「はやい」の漢字は何ですか？",
                        "answer": "速い",
                        "explanation": "はやいは速いという漢字で書きます。",
                        "hint": "はやい",
                        "tags": ["漢字", "形容詞"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_e2_3",
                        "question": "「みず」の漢字は何ですか？",
                        "answer": "水",
                        "explanation": "みずは水という漢字で書きます。",
                        "hint": "H2O",
                        "tags": ["漢字", "自然"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "jp_e2_s1",
                        "question": "「あさ」の反対は何ですか？",
                        "answer": "ゆう",
                        "explanation": "朝の反対は夕（ゆう）です。",
                        "hint": "あさ↔",
                        "tags": ["言葉", "反対語"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "jp_e2_s2",
                        "question": "「きょう」の次は何ですか？",
                        "answer": "あした",
                        "explanation": "今日の次は明日です。",
                        "hint": "にち",
                        "tags": ["言葉", "時間"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "jp_e2_a1",
                        "question": "「うえ」の反対は何ですか？",
                        "answer": "した",
                        "explanation": "上の反対は下です。",
                        "hint": "うえ↔",
                        "tags": ["言葉", "反対語"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "3": {
                "basic": [
                    {
                        "id": "jp_e3_1",
                        "question": "「かぜ」の漢字は何ですか？",
                        "answer": "風",
                        "explanation": "かぜは風という漢字で書きます。",
                        "hint": "そら",
                        "tags": ["漢字", "自然"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_e3_2",
                        "question": "「なつ」の漢字は何ですか？",
                        "answer": "夏",
                        "explanation": "なつは夏という漢字で書きます。",
                        "hint": "きせつ",
                        "tags": ["漢字", "季節"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_e3_3",
                        "question": "「へや」の漢字は何ですか？",
                        "answer": "部屋",
                        "explanation": "へやは部屋という漢字で書きます。",
                        "hint": "いえ",
                        "tags": ["漢字", "建物"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "jp_e3_s1",
                        "question": "「たかい」の反対は何ですか？",
                        "answer": "ひくい",
                        "explanation": "高いの反対は低いです。",
                        "hint": "たかい↔",
                        "tags": ["言葉", "反対語"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "jp_e3_s2",
                        "question": "「ふゆ」の次は何ですか？",
                        "answer": "はる",
                        "explanation": "冬の次は春です。",
                        "hint": "きせつ",
                        "tags": ["言葉", "季節"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "jp_e3_a1",
                        "question": "「くるま」の漢字は何ですか？",
                        "answer": "車",
                        "explanation": "くるまは車という漢字で書きます。",
                        "hint": "のりもの",
                        "tags": ["漢字", "乗り物"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "4": {
                "basic": [
                    {
                        "id": "jp_e4_1",
                        "question": "「き」の漢字は何ですか？",
                        "answer": "木",
                        "explanation": "きは木という漢字で書きます。",
                        "hint": "しげん",
                        "tags": ["漢字", "自然"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_e4_2",
                        "question": "「ともだち」の漢字は何ですか？",
                        "answer": "友達",
                        "explanation": "ともだちは友達という漢字で書きます。",
                        "hint": "なかま",
                        "tags": ["漢字", "人間関係"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_e4_3",
                        "question": "「かお」の漢字は何ですか？",
                        "answer": "顔",
                        "explanation": "かおは顔という漢字で書きます。",
                        "hint": "からだ",
                        "tags": ["漢字", "体"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "jp_e4_s1",
                        "question": "「あつい」の漢字は何ですか？（温度）",
                        "answer": "暑い",
                        "explanation": "温度が高い場合は暑いです。",
                        "hint": "おん",
                        "tags": ["漢字", "形容詞"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "jp_e4_s2",
                        "question": "「いちにち」は何時間ですか？",
                        "answer": "24",
                        "explanation": "1日は24時間です。",
                        "hint": "にじゅうよじかん",
                        "tags": ["言葉", "時間"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "jp_e4_a1",
                        "question": "「うた」の漢字は何ですか？",
                        "answer": "歌",
                        "explanation": "うたは歌という漢字で書きます。",
                        "hint": "おんがく",
                        "tags": ["漢字", "音楽"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "5": {
                "basic": [
                    {
                        "id": "jp_e5_1",
                        "question": "「ほん」の漢字は何ですか？",
                        "answer": "本",
                        "explanation": "ほんは本という漢字で書きます。",
                        "hint": "よむ",
                        "tags": ["漢字", "読み物"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_e5_2",
                        "question": "「みち」の漢字は何ですか？",
                        "answer": "道",
                        "explanation": "みちは道という漢字で書きます。",
                        "hint": "あるく",
                        "tags": ["漢字", "場所"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_e5_3",
                        "question": "「て」の漢字は何ですか？",
                        "answer": "手",
                        "explanation": "ては手という漢字で書きます。",
                        "hint": "からだ",
                        "tags": ["漢字", "体"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "jp_e5_s1",
                        "question": "「あさひ」の漢字は何ですか？",
                        "answer": "朝日",
                        "explanation": "あさひは朝日という漢字で書きます。",
                        "hint": "ひ",
                        "tags": ["漢字", "自然"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "jp_e5_s2",
                        "question": "「さくら」の漢字は何ですか？",
                        "answer": "桜",
                        "explanation": "さくらは桜という漢字で書きます。",
                        "hint": "はな",
                        "tags": ["漢字", "植物"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "jp_e5_a1",
                        "question": "「あめ」の漢字は何ですか？（雨）",
                        "answer": "雨",
                        "explanation": "あめは雨という漢字で書きます。",
                        "hint": "てんき",
                        "tags": ["漢字", "自然"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "6": {
                "basic": [
                    {
                        "id": "jp_e6_1",
                        "question": "「め」の漢字は何ですか？",
                        "answer": "目",
                        "explanation": "めは目という漢字で書きます。",
                        "hint": "からだ",
                        "tags": ["漢字", "体"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_e6_2",
                        "question": "「くち」の漢字は何ですか？",
                        "answer": "口",
                        "explanation": "くちは口という漢字で書きます。",
                        "hint": "からだ",
                        "tags": ["漢字", "体"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_e6_3",
                        "question": "「いえ」の漢字は何ですか？",
                        "answer": "家",
                        "explanation": "いえは家という漢字で書きます。",
                        "hint": "すまい",
                        "tags": ["漢字", "建物"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "jp_e6_s1",
                        "question": "「やま」の漢字は何ですか？",
                        "answer": "山",
                        "explanation": "やまは山という漢字で書きます。",
                        "hint": "たかい",
                        "tags": ["漢字", "自然"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "jp_e6_s2",
                        "question": "「かわ」の漢字は何ですか？",
                        "answer": "川",
                        "explanation": "かわは川という漢字で書きます。",
                        "hint": "ながれる",
                        "tags": ["漢字", "自然"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "jp_e6_a1",
                        "question": "「そら」の漢字は何ですか？",
                        "answer": "空",
                        "explanation": "そらは空という漢字で書きます。",
                        "hint": "あおい",
                        "tags": ["漢字", "自然"],
                        "difficulty": "advanced"
                    }
                ]
            }
        },
        "junior_high": {
            "1": {
                "basic": [
                    {
                        "id": "jp_j1_1",
                        "question": "主語と述語の関係とは何ですか？",
                        "answer": "「～が」「～だ」",
                        "explanation": "主語は「～が」、述語は「～だ」の関係です。",
                        "hint": "が、だ",
                        "tags": ["文法", "主語述語"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_j1_2",
                        "question": "「美しい」は何詞ですか？",
                        "answer": "形容詞",
                        "explanation": "「美しい」は形容詞（い形容詞）です。",
                        "hint": "けいようし",
                        "tags": ["文法", "品詞"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_j1_3",
                        "question": "「走る」は何詞ですか？",
                        "answer": "動詞",
                        "explanation": "「走る」は動詞です。",
                        "hint": "どうし",
                        "tags": ["文法", "品詞"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "jp_j1_s1",
                        "question": "連体修飾語とは何ですか？",
                        "answer": "体言を修飾する語",
                        "explanation": "名詞（体言）を修飾する言葉です。「青い空」の「青い」など。",
                        "hint": "たいげん",
                        "tags": ["文法", "修飾語"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "jp_j1_s2",
                        "question": "「静かな」は何詞ですか？",
                        "answer": "形容動詞",
                        "explanation": "「静かな」は形容動詞（な形容詞）です。",
                        "hint": "けいようどうし",
                        "tags": ["文法", "品詞"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "jp_j1_a1",
                        "question": "体言止めとは何ですか？",
                        "answer": "名詞で文を終わる",
                        "explanation": "文を名詞（体言）で終わる表現技法です。",
                        "hint": "たいげん",
                        "tags": ["修辞", "体言止め"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "2": {
                "basic": [
                    {
                        "id": "jp_j2_1",
                        "question": "比喩とは何ですか？",
                        "answer": "何かに例える",
                        "explanation": "何かを別のものに例えて表現する技法です。",
                        "hint": "たとえ",
                        "tags": ["修辞", "比喩"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_j2_2",
                        "question": "「～のようだ」は何の比喩ですか？",
                        "answer": "直喩",
                        "explanation": "「～のようだ」「～のような」を使う比喩を直喩と言います。",
                        "hint": "ちょくゆ",
                        "tags": ["修辞", "直喩"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_j2_3",
                        "question": "倒置法とは何ですか？",
                        "answer": "語順を逆にする",
                        "explanation": "通常の語順を逆にして強調する技法です。",
                        "hint": "ぎょじゅん",
                        "tags": ["修辞", "倒置法"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "jp_j2_s1",
                        "question": "「それはまるで夢のようだった」は何の比喩ですか？",
                        "answer": "直喩",
                        "explanation": "「～のようだ」を使っているので直喩です。",
                        "hint": "まるで",
                        "tags": ["修辞", "直喩"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "jp_j2_s2",
                        "question": "「春が来た」を「来た、春」とするのは何の技法ですか？",
                        "answer": "倒置法",
                        "explanation": "語順を逆にした倒置法です。",
                        "hint": "ぎゃく",
                        "tags": ["修辞", "倒置法"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "jp_j2_a1",
                        "question": "隠喩とは何ですか？",
                        "answer": "直接例えずに例える",
                        "explanation": "「～のようだ」を使わずに直接例える比喩です。「君は僕の光」など。",
                        "hint": "いんゆ",
                        "tags": ["修辞", "隠喩"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "3": {
                "basic": [
                    {
                        "id": "jp_j3_1",
                        "question": "「和歌」の形式は何ですか？",
                        "answer": "五七五七七",
                        "explanation": "和歌は5-7-5-7-7の31音で構成されます。",
                        "hint": "いちさんごしちご",
                        "tags": ["古典", "和歌"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_j3_2",
                        "question": "「俳句」の形式は何ですか？",
                        "answer": "五七五",
                        "explanation": "俳句は5-7-5の17音で構成されます。",
                        "hint": "いちさんご",
                        "tags": ["古典", "俳句"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_j3_3",
                        "question": "「万葉集」はいつの時代の歌集ですか？",
                        "answer": "奈良時代",
                        "explanation": "万葉集は奈良時代に編纂された最古の歌集です。",
                        "hint": "なら",
                        "tags": ["古典", "万葉集"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "jp_j3_s1",
                        "question": "「古今和歌集」はいつの時代の歌集ですか？",
                        "answer": "平安時代",
                        "explanation": "古今和歌集は平安時代に編纂されました。",
                        "hint": "へいあん",
                        "tags": ["古典", "古今和歌集"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "jp_j3_s2",
                        "question": "松尾芭蕉は何の代表者ですか？",
                        "answer": "俳句",
                        "explanation": "松尾芭蕉は俳諧（俳句）の代表者です。",
                        "hint": "はいく",
                        "tags": ["古典", "芭蕉"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "jp_j3_a1",
                        "question": "「新古今和歌集」の特徴は何ですか？",
                        "answer": "優美な歌風",
                        "explanation": "新古今和歌集は優美で技巧的な歌風が特徴です。",
                        "hint": "ゆうび",
                        "tags": ["古典", "新古今和歌集"],
                        "difficulty": "advanced"
                    }
                ]
            }
        },
        "high_school": {
            "1": {
                "basic": [
                    {
                        "id": "jp_h1_1",
                        "question": "「古事記」はいつ成立しましたか？",
                        "answer": "712年",
                        "explanation": "古事記は712年に太安万侶によって編纂されました。",
                        "hint": "ならじだい",
                        "tags": ["古典", "古事記"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_h1_2",
                        "question": "「日本書紀」はいつ成立しましたか？",
                        "answer": "720年",
                        "explanation": "日本書紀は720年に成立した勅撰史書です。",
                        "hint": "ならじだい",
                        "tags": ["古典", "日本書紀"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_h1_3",
                        "question": "「枕草子」の作者は誰ですか？",
                        "answer": "清少納言",
                        "explanation": "清少納言が平安時代に執筆しました。",
                        "hint": "せいしょうなごん",
                        "tags": ["古典", "枕草子"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "jp_h1_s1",
                        "question": "「源氏物語」の作者は誰ですか？",
                        "answer": "紫式部",
                        "explanation": "紫式部が平安時代に執筆しました。",
                        "hint": "むらさきしきぶ",
                        "tags": ["古典", "源氏物語"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "jp_h1_s2",
                        "question": "「方丈記」の作者は誰ですか？",
                        "answer": "鴨長明",
                        "explanation": "鴨長明が鎌倉時代に執筆しました。",
                        "hint": "かものちょうめい",
                        "tags": ["古典", "方丈記"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "jp_h1_a1",
                        "question": "「徒然草」の作者は誰ですか？",
                        "answer": "吉田兼好",
                        "explanation": "吉田兼好（兼好法師）が鎌倉〜室町時代に執筆しました。",
                        "hint": "よしだけんこう",
                        "tags": ["古典", "徒然草"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "2": {
                "basic": [
                    {
                        "id": "jp_h2_1",
                        "question": "「奥の細道」の作者は誰ですか？",
                        "answer": "松尾芭蕉",
                        "explanation": "松尾芭蕉が江戸時代に紀行文として執筆しました。",
                        "hint": "ばしょう",
                        "tags": ["古典", "奥の細道"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_h2_2",
                        "question": "「雨月物語」の作者は誰ですか？",
                        "answer": "上田秋成",
                        "explanation": "上田秋成が江戸時代に読本として執筆しました。",
                        "hint": "うえだあきなり",
                        "tags": ["古典", "雨月物語"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_h2_3",
                        "question": "「浮世草子」の代表作品は何ですか？",
                        "answer": "好色一代男",
                        "explanation": "井原西鶴の『好色一代男』が代表作です。",
                        "hint": "いはらさいかく",
                        "tags": ["古典", "浮世草子"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "jp_h2_s1",
                        "question": "「曾根崎心中」の作者は誰ですか？",
                        "answer": "近松門左衛門",
                        "explanation": "近松門左衛門が江戸時代に人形浄瑠璃として執筆しました。",
                        "hint": "ちかまつ",
                        "tags": ["古典", "近松"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "jp_h2_s2",
                        "question": "「東海道中膝栗毛」の作者は誰ですか？",
                        "answer": "十返舎一九",
                        "explanation": "十返舎一九が江戸時代に滑稽本として執筆しました。",
                        "hint": "じっぺんしゃいっく",
                        "tags": ["古典", "膝栗毛"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "jp_h2_a1",
                        "question": "「南総里見八犬伝」の作者は誰ですか？",
                        "answer": "曲亭馬琴",
                        "explanation": "曲亭馬琴（滝沢馬琴）が江戸時代に執筆しました。",
                        "hint": "きょくていばきん",
                        "tags": ["古典", "八犬伝"],
                        "difficulty": "advanced"
                    }
                ]
            },
            "3": {
                "basic": [
                    {
                        "id": "jp_h3_1",
                        "question": "「吾輩は猫である」の作者は誰ですか？",
                        "answer": "夏目漱石",
                        "explanation": "夏目漱石が明治時代に執筆しました。",
                        "hint": "そうせき",
                        "tags": ["近代文学", "漱石"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_h3_2",
                        "question": "「舞姫」の作者は誰ですか？",
                        "answer": "森鴎外",
                        "explanation": "森鴎外が明治時代に執筆しました。",
                        "hint": "おうがい",
                        "tags": ["近代文学", "鴎外"],
                        "difficulty": "basic"
                    },
                    {
                        "id": "jp_h3_3",
                        "question": "「或る女」の作者は誰ですか？",
                        "answer": "樋口一葉",
                        "explanation": "樋口一葉が明治時代に執筆しました。",
                        "hint": "ひぐちいちよう",
                        "tags": ["近代文学", "一葉"],
                        "difficulty": "basic"
                    }
                ],
                "standard": [
                    {
                        "id": "jp_h3_s1",
                        "question": "「こころ」の作者は誰ですか？",
                        "answer": "夏目漱石",
                        "explanation": "夏目漱石が明治〜大正時代に執筆しました。",
                        "hint": "そうせき",
                        "tags": ["近代文学", "漱石"],
                        "difficulty": "standard"
                    },
                    {
                        "id": "jp_h3_s2",
                        "question": "「暗夜行路」の作者は誰ですか？",
                        "answer": "志賀直哉",
                        "explanation": "志賀直哉が大正〜昭和時代に執筆しました。",
                        "hint": "しがなおや",
                        "tags": ["近代文学", "志賀"],
                        "difficulty": "standard"
                    }
                ],
                "advanced": [
                    {
                        "id": "jp_h3_a1",
                        "question": "「斜陽」の作者は誰ですか？",
                        "answer": "太宰治",
                        "explanation": "太宰治が昭和時代に執筆しました。",
                        "hint": "だざいおさむ",
                        "tags": ["近代文学", "太宰"],
                        "difficulty": "advanced"
                    }
                ]
            }
        }
    }
};

// 既存のQUESTIONS_DATAとマージする関数
function mergeExpandedQuestions() {
    if (typeof QUESTIONS_DATA !== 'undefined') {
        // 既存のQUESTIONS_DATAにEXPANDED_QUESTIONSをマージ
        Object.keys(EXPANDED_QUESTIONS).forEach(subject => {
            if (!QUESTIONS_DATA[subject]) {
                QUESTIONS_DATA[subject] = EXPANDED_QUESTIONS[subject];
            } else {
                Object.keys(EXPANDED_QUESTIONS[subject]).forEach(level => {
                    if (!QUESTIONS_DATA[subject][level]) {
                        QUESTIONS_DATA[subject][level] = EXPANDED_QUESTIONS[subject][level];
                    } else {
                        Object.keys(EXPANDED_QUESTIONS[subject][level]).forEach(grade => {
                            if (!QUESTIONS_DATA[subject][level][grade]) {
                                QUESTIONS_DATA[subject][level][grade] = EXPANDED_QUESTIONS[subject][level][grade];
                            } else {
                                // 既存の難易度に拡張問題を追加
                                Object.keys(EXPANDED_QUESTIONS[subject][level][grade]).forEach(difficulty => {
                                    if (!QUESTIONS_DATA[subject][level][grade][difficulty]) {
                                        QUESTIONS_DATA[subject][level][grade][difficulty] = EXPANDED_QUESTIONS[subject][level][grade][difficulty];
                                    } else {
                                        QUESTIONS_DATA[subject][level][grade][difficulty] = QUESTIONS_DATA[subject][level][grade][difficulty].concat(EXPANDED_QUESTIONS[subject][level][grade][difficulty]);
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    } else {
        // QUESTIONS_DATAが存在しない場合はEXPANDED_QUESTIONSをQUESTIONS_DATAとして定義
        window.QUESTIONS_DATA = EXPANDED_QUESTIONS;
    }
}

// グローバルスコープに公開
window.EXPANDED_QUESTIONS = EXPANDED_QUESTIONS;
window.mergeExpandedQuestions = mergeExpandedQuestions;

// 自動的にマージ実行
if (typeof window.addEventListener !== 'undefined') {
    window.addEventListener('DOMContentLoaded', mergeExpandedQuestions);
} else {
    // DOMContentLoadedが使えない環境では即時実行
    mergeExpandedQuestions();
}
