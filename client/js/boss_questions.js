// client/js/boss_questions.js
// ボス戦用の問題データ（server/data/boss_questions.json と同じ内容）。
// ボス戦はサーバーを介さないローカル（ボット）戦として行われるため、
// クライアント側にも同じ問題データを持たせておく必要がある。
// 学年（1〜12）×教科（math/jp/eng/sci/soc）ごとに問題が用意されている。
const BOSS_QUESTIONS_DATA = {
    "boss": {
        "1": {
            "math": [
                {
                    "question": "15 + 27 = ?",
                    "answer": "42"
                },
                {
                    "question": "52 - 18 = ?",
                    "answer": "34"
                },
                {
                    "question": "8 × 7 = ?",
                    "answer": "56"
                },
                {
                    "question": "63 ÷ 9 = ?",
                    "answer": "7"
                },
                {
                    "question": "√81 = ?",
                    "answer": "9"
                },
                {
                    "question": "2⁵ = ?",
                    "answer": "32"
                },
                {
                    "question": "100 - 37 = ?",
                    "answer": "63"
                },
                {
                    "question": "12 × 4 = ?",
                    "answer": "48"
                },
                {
                    "question": "√64 = ?",
                    "answer": "8"
                },
                {
                    "question": "3⁴ = ?",
                    "answer": "81"
                }
            ],
            "jp": [
                {
                    "question": "「梅」の読み方は？",
                    "answer": "うめ"
                },
                {
                    "question": "「桜」の読み方は？",
                    "answer": "さくら"
                },
                {
                    "question": "「富士」の読み方は？",
                    "answer": "ふじ"
                },
                {
                    "question": "「海」の読み方は？",
                    "answer": "うみ"
                },
                {
                    "question": "「山」の読み方は？",
                    "answer": "やま"
                },
                {
                    "question": "「空」の読み方は？",
                    "answer": "そら"
                },
                {
                    "question": "「川」の読み方は？",
                    "answer": "かわ"
                },
                {
                    "question": "「風」の読み方は？",
                    "answer": "かぜ"
                },
                {
                    "question": "「雨」の読み方は？",
                    "answer": "あめ"
                },
                {
                    "question": "「雪」の読み方は？",
                    "answer": "ゆき"
                }
            ],
            "eng": [
                {
                    "question": "What is the past tense of 'go'?",
                    "answer": "went"
                },
                {
                    "question": "What is the past tense of 'eat'?",
                    "answer": "ate"
                },
                {
                    "question": "What is the past tense of 'see'?",
                    "answer": "saw"
                },
                {
                    "question": "What is the past tense of 'take'?",
                    "answer": "took"
                },
                {
                    "question": "What is the past tense of 'make'?",
                    "answer": "made"
                },
                {
                    "question": "What is the past tense of 'come'?",
                    "answer": "came"
                },
                {
                    "question": "What is the past tense of 'give'?",
                    "answer": "gave"
                },
                {
                    "question": "What is the past tense of 'write'?",
                    "answer": "wrote"
                },
                {
                    "question": "What is the past tense of 'read'?",
                    "answer": "read"
                },
                {
                    "question": "What is the past tense of 'know'?",
                    "answer": "knew"
                }
            ],
            "sci": [
                {
                    "question": "水の化学式は？",
                    "answer": "H2O"
                },
                {
                    "question": "酸素の化学式は？",
                    "answer": "O2"
                },
                {
                    "question": "植物の光合成に必要なものは？",
                    "answer": "光"
                },
                {
                    "question": "水は何度で凍る？",
                    "answer": "0"
                },
                {
                    "question": "水は何度で沸騰する？",
                    "answer": "100"
                },
                {
                    "question": "地球を一周する時間は？",
                    "answer": "24"
                },
                {
                    "question": "1年に何ヶ月ある？",
                    "answer": "12"
                },
                {
                    "question": "1日は何時間？",
                    "answer": "24"
                },
                {
                    "question": "1時間は何分？",
                    "answer": "60"
                },
                {
                    "question": "1分は何秒？",
                    "answer": "60"
                }
            ],
            "soc": [
                {
                    "question": "日本の首都は？",
                    "answer": "東京"
                },
                {
                    "question": "アメリカの首都は？",
                    "answer": "ワシントン"
                },
                {
                    "question": "イギリスの首都は？",
                    "answer": "ロンドン"
                },
                {
                    "question": "フランスの首都は？",
                    "answer": "パリ"
                },
                {
                    "question": "ドイツの首都は？",
                    "answer": "ベルリン"
                },
                {
                    "question": "中国の首都は？",
                    "answer": "北京"
                },
                {
                    "question": "韓国の首都は？",
                    "answer": "ソウル"
                },
                {
                    "question": "ロシアの首都は？",
                    "answer": "モスクワ"
                },
                {
                    "question": "イタリアの首都は？",
                    "answer": "ローマ"
                },
                {
                    "question": "スペインの首都は？",
                    "answer": "マドリード"
                }
            ]
        },
        "2": {
            "math": [
                {
                    "question": "√144 = ?",
                    "answer": "12"
                },
                {
                    "question": "2⁶ = ?",
                    "answer": "64"
                },
                {
                    "question": "15 × 7 = ?",
                    "answer": "105"
                },
                {
                    "question": "√225 = ?",
                    "answer": "15"
                },
                {
                    "question": "3⁴ = ?",
                    "answer": "81"
                },
                {
                    "question": "24 × 5 = ?",
                    "answer": "120"
                },
                {
                    "question": "√256 = ?",
                    "answer": "16"
                },
                {
                    "question": "2⁸ = ?",
                    "answer": "256"
                },
                {
                    "question": "18 × 6 = ?",
                    "answer": "108"
                },
                {
                    "question": "√324 = ?",
                    "answer": "18"
                }
            ],
            "jp": [
                {
                    "question": "「梅」の読み方は？",
                    "answer": "うめ"
                },
                {
                    "question": "「桜」の読み方は？",
                    "answer": "さくら"
                },
                {
                    "question": "「富士」の読み方は？",
                    "answer": "ふじ"
                },
                {
                    "question": "「海」の読み方は？",
                    "answer": "うみ"
                },
                {
                    "question": "「山」の読み方は？",
                    "answer": "やま"
                },
                {
                    "question": "「空」の読み方は？",
                    "answer": "そら"
                },
                {
                    "question": "「川」の読み方は？",
                    "answer": "かわ"
                },
                {
                    "question": "「風」の読み方は？",
                    "answer": "かぜ"
                },
                {
                    "question": "「雨」の読み方は？",
                    "answer": "あめ"
                },
                {
                    "question": "「雪」の読み方は？",
                    "answer": "ゆき"
                }
            ],
            "eng": [
                {
                    "question": "What is the past tense of 'go'?",
                    "answer": "went"
                },
                {
                    "question": "What is the past tense of 'eat'?",
                    "answer": "ate"
                },
                {
                    "question": "What is the past tense of 'see'?",
                    "answer": "saw"
                },
                {
                    "question": "What is the past tense of 'take'?",
                    "answer": "took"
                },
                {
                    "question": "What is the past tense of 'make'?",
                    "answer": "made"
                },
                {
                    "question": "What is the past tense of 'come'?",
                    "answer": "came"
                },
                {
                    "question": "What is the past tense of 'give'?",
                    "answer": "gave"
                },
                {
                    "question": "What is the past tense of 'write'?",
                    "answer": "wrote"
                },
                {
                    "question": "What is the past tense of 'read'?",
                    "answer": "read"
                },
                {
                    "question": "What is the past tense of 'know'?",
                    "answer": "knew"
                }
            ],
            "sci": [
                {
                    "question": "水の化学式は？",
                    "answer": "H2O"
                },
                {
                    "question": "酸素の化学式は？",
                    "answer": "O2"
                },
                {
                    "question": "二酸化炭素の化学式は？",
                    "answer": "CO2"
                },
                {
                    "question": "水素の化学式は？",
                    "answer": "H2"
                },
                {
                    "question": "窒素の化学式は？",
                    "answer": "N2"
                },
                {
                    "question": "ナトリウムの化学式は？",
                    "answer": "Na"
                },
                {
                    "question": "塩素の化学式は？",
                    "answer": "Cl"
                },
                {
                    "question": "カリウムの化学式は？",
                    "answer": "K"
                },
                {
                    "question": "カルシウムの化学式は？",
                    "answer": "Ca"
                },
                {
                    "question": "鉄の化学式は？",
                    "answer": "Fe"
                }
            ],
            "soc": [
                {
                    "question": "日本の首都は？",
                    "answer": "東京"
                },
                {
                    "question": "アメリカの首都は？",
                    "answer": "ワシントン"
                },
                {
                    "question": "イギリスの首都は？",
                    "answer": "ロンドン"
                },
                {
                    "question": "フランスの首都は？",
                    "answer": "パリ"
                },
                {
                    "question": "ドイツの首都は？",
                    "answer": "ベルリン"
                },
                {
                    "question": "中国の首都は？",
                    "answer": "北京"
                },
                {
                    "question": "韓国の首都は？",
                    "answer": "ソウル"
                },
                {
                    "question": "ロシアの首都は？",
                    "answer": "モスクワ"
                },
                {
                    "question": "イタリアの首都は？",
                    "answer": "ローマ"
                },
                {
                    "question": "スペインの首都は？",
                    "answer": "マドリード"
                }
            ]
        },
        "3": {
            "math": [
                {
                    "question": "√400 = ?",
                    "answer": "20"
                },
                {
                    "question": "5³ = ?",
                    "answer": "125"
                },
                {
                    "question": "32 × 4 = ?",
                    "answer": "128"
                },
                {
                    "question": "√576 = ?",
                    "answer": "24"
                },
                {
                    "question": "6³ = ?",
                    "answer": "216"
                },
                {
                    "question": "27 × 3 = ?",
                    "answer": "81"
                },
                {
                    "question": "√625 = ?",
                    "answer": "25"
                },
                {
                    "question": "7³ = ?",
                    "answer": "343"
                },
                {
                    "question": "35 × 2 = ?",
                    "answer": "70"
                },
                {
                    "question": "√729 = ?",
                    "answer": "27"
                }
            ],
            "jp": [
                {
                    "question": "「梅」の読み方は？",
                    "answer": "うめ"
                },
                {
                    "question": "「桜」の読み方は？",
                    "answer": "さくら"
                },
                {
                    "question": "「富士」の読み方は？",
                    "answer": "ふじ"
                },
                {
                    "question": "「海」の読み方は？",
                    "answer": "うみ"
                },
                {
                    "question": "「山」の読み方は？",
                    "answer": "やま"
                },
                {
                    "question": "「空」の読み方は？",
                    "answer": "そら"
                },
                {
                    "question": "「川」の読み方は？",
                    "answer": "かわ"
                },
                {
                    "question": "「風」の読み方は？",
                    "answer": "かぜ"
                },
                {
                    "question": "「雨」の読み方は？",
                    "answer": "あめ"
                },
                {
                    "question": "「雪」の読み方は？",
                    "answer": "ゆき"
                }
            ],
            "eng": [
                {
                    "question": "What is the past tense of 'go'?",
                    "answer": "went"
                },
                {
                    "question": "What is the past tense of 'eat'?",
                    "answer": "ate"
                },
                {
                    "question": "What is the past tense of 'see'?",
                    "answer": "saw"
                },
                {
                    "question": "What is the past tense of 'take'?",
                    "answer": "took"
                },
                {
                    "question": "What is the past tense of 'make'?",
                    "answer": "made"
                },
                {
                    "question": "What is the past tense of 'come'?",
                    "answer": "came"
                },
                {
                    "question": "What is the past tense of 'give'?",
                    "answer": "gave"
                },
                {
                    "question": "What is the past tense of 'write'?",
                    "answer": "wrote"
                },
                {
                    "question": "What is the past tense of 'read'?",
                    "answer": "read"
                },
                {
                    "question": "What is the past tense of 'know'?",
                    "answer": "knew"
                }
            ],
            "sci": [
                {
                    "question": "水の化学式は？",
                    "answer": "H2O"
                },
                {
                    "question": "酸素の化学式は？",
                    "answer": "O2"
                },
                {
                    "question": "二酸化炭素の化学式は？",
                    "answer": "CO2"
                },
                {
                    "question": "水素の化学式は？",
                    "answer": "H2"
                },
                {
                    "question": "窒素の化学式は？",
                    "answer": "N2"
                },
                {
                    "question": "ナトリウムの化学式は？",
                    "answer": "Na"
                },
                {
                    "question": "塩素の化学式は？",
                    "answer": "Cl"
                },
                {
                    "question": "カリウムの化学式は？",
                    "answer": "K"
                },
                {
                    "question": "カルシウムの化学式は？",
                    "answer": "Ca"
                },
                {
                    "question": "鉄の化学式は？",
                    "answer": "Fe"
                }
            ],
            "soc": [
                {
                    "question": "日本の首都は？",
                    "answer": "東京"
                },
                {
                    "question": "アメリカの首都は？",
                    "answer": "ワシントン"
                },
                {
                    "question": "イギリスの首都は？",
                    "answer": "ロンドン"
                },
                {
                    "question": "フランスの首都は？",
                    "answer": "パリ"
                },
                {
                    "question": "ドイツの首都は？",
                    "answer": "ベルリン"
                },
                {
                    "question": "中国の首都は？",
                    "answer": "北京"
                },
                {
                    "question": "韓国の首都は？",
                    "answer": "ソウル"
                },
                {
                    "question": "ロシアの首都は？",
                    "answer": "モスクワ"
                },
                {
                    "question": "イタリアの首都は？",
                    "answer": "ローマ"
                },
                {
                    "question": "スペインの首都は？",
                    "answer": "マドリード"
                }
            ]
        },
        "4": {
            "math": [
                {
                    "question": "√841 = ?",
                    "answer": "29"
                },
                {
                    "question": "8³ = ?",
                    "answer": "512"
                },
                {
                    "question": "45 × 2 = ?",
                    "answer": "90"
                },
                {
                    "question": "√961 = ?",
                    "answer": "31"
                },
                {
                    "question": "9³ = ?",
                    "answer": "729"
                },
                {
                    "question": "56 × 2 = ?",
                    "answer": "112"
                },
                {
                    "question": "√1024 = ?",
                    "answer": "32"
                },
                {
                    "question": "10³ = ?",
                    "answer": "1000"
                },
                {
                    "question": "48 × 3 = ?",
                    "answer": "144"
                },
                {
                    "question": "√1156 = ?",
                    "answer": "34"
                }
            ],
            "jp": [
                {
                    "question": "「梅」の読み方は？",
                    "answer": "うめ"
                },
                {
                    "question": "「桜」の読み方は？",
                    "answer": "さくら"
                },
                {
                    "question": "「富士」の読み方は？",
                    "answer": "ふじ"
                },
                {
                    "question": "「海」の読み方は？",
                    "answer": "うみ"
                },
                {
                    "question": "「山」の読み方は？",
                    "answer": "やま"
                },
                {
                    "question": "「空」の読み方は？",
                    "answer": "そら"
                },
                {
                    "question": "「川」の読み方は？",
                    "answer": "かわ"
                },
                {
                    "question": "「風」の読み方は？",
                    "answer": "かぜ"
                },
                {
                    "question": "「雨」の読み方は？",
                    "answer": "あめ"
                },
                {
                    "question": "「雪」の読み方は？",
                    "answer": "ゆき"
                }
            ],
            "eng": [
                {
                    "question": "What is the past tense of 'go'?",
                    "answer": "went"
                },
                {
                    "question": "What is the past tense of 'eat'?",
                    "answer": "ate"
                },
                {
                    "question": "What is the past tense of 'see'?",
                    "answer": "saw"
                },
                {
                    "question": "What is the past tense of 'take'?",
                    "answer": "took"
                },
                {
                    "question": "What is the past tense of 'make'?",
                    "answer": "made"
                },
                {
                    "question": "What is the past tense of 'come'?",
                    "answer": "came"
                },
                {
                    "question": "What is the past tense of 'give'?",
                    "answer": "gave"
                },
                {
                    "question": "What is the past tense of 'write'?",
                    "answer": "wrote"
                },
                {
                    "question": "What is the past tense of 'read'?",
                    "answer": "read"
                },
                {
                    "question": "What is the past tense of 'know'?",
                    "answer": "knew"
                }
            ],
            "sci": [
                {
                    "question": "水の化学式は？",
                    "answer": "H2O"
                },
                {
                    "question": "酸素の化学式は？",
                    "answer": "O2"
                },
                {
                    "question": "二酸化炭素の化学式は？",
                    "answer": "CO2"
                },
                {
                    "question": "水素の化学式は？",
                    "answer": "H2"
                },
                {
                    "question": "窒素の化学式は？",
                    "answer": "N2"
                },
                {
                    "question": "ナトリウムの化学式は？",
                    "answer": "Na"
                },
                {
                    "question": "塩素の化学式は？",
                    "answer": "Cl"
                },
                {
                    "question": "カリウムの化学式は？",
                    "answer": "K"
                },
                {
                    "question": "カルシウムの化学式は？",
                    "answer": "Ca"
                },
                {
                    "question": "鉄の化学式は？",
                    "answer": "Fe"
                }
            ],
            "soc": [
                {
                    "question": "日本の首都は？",
                    "answer": "東京"
                },
                {
                    "question": "アメリカの首都は？",
                    "answer": "ワシントン"
                },
                {
                    "question": "イギリスの首都は？",
                    "answer": "ロンドン"
                },
                {
                    "question": "フランスの首都は？",
                    "answer": "パリ"
                },
                {
                    "question": "ドイツの首都は？",
                    "answer": "ベルリン"
                },
                {
                    "question": "中国の首都は？",
                    "answer": "北京"
                },
                {
                    "question": "韓国の首都は？",
                    "answer": "ソウル"
                },
                {
                    "question": "ロシアの首都は？",
                    "answer": "モスクワ"
                },
                {
                    "question": "イタリアの首都は？",
                    "answer": "ローマ"
                },
                {
                    "question": "スペインの首都は？",
                    "answer": "マドリード"
                }
            ]
        },
        "5": {
            "math": [
                {
                    "question": "√1296 = ?",
                    "answer": "36"
                },
                {
                    "question": "11³ = ?",
                    "answer": "1331"
                },
                {
                    "question": "67 × 3 = ?",
                    "answer": "201"
                },
                {
                    "question": "√1369 = ?",
                    "answer": "37"
                },
                {
                    "question": "12³ = ?",
                    "answer": "1728"
                },
                {
                    "question": "78 × 3 = ?",
                    "answer": "234"
                },
                {
                    "question": "√1444 = ?",
                    "answer": "38"
                },
                {
                    "question": "13³ = ?",
                    "answer": "2197"
                },
                {
                    "question": "89 × 3 = ?",
                    "answer": "267"
                },
                {
                    "question": "√1521 = ?",
                    "answer": "39"
                }
            ],
            "jp": [
                {
                    "question": "「梅」の読み方は？",
                    "answer": "うめ"
                },
                {
                    "question": "「桜」の読み方は？",
                    "answer": "さくら"
                },
                {
                    "question": "「富士」の読み方は？",
                    "answer": "ふじ"
                },
                {
                    "question": "「海」の読み方は？",
                    "answer": "うみ"
                },
                {
                    "question": "「山」の読み方は？",
                    "answer": "やま"
                },
                {
                    "question": "「空」の読み方は？",
                    "answer": "そら"
                },
                {
                    "question": "「川」の読み方は？",
                    "answer": "かわ"
                },
                {
                    "question": "「風」の読み方は？",
                    "answer": "かぜ"
                },
                {
                    "question": "「雨」の読み方は？",
                    "answer": "あめ"
                },
                {
                    "question": "「雪」の読み方は？",
                    "answer": "ゆき"
                }
            ],
            "eng": [
                {
                    "question": "What is the past tense of 'go'?",
                    "answer": "went"
                },
                {
                    "question": "What is the past tense of 'eat'?",
                    "answer": "ate"
                },
                {
                    "question": "What is the past tense of 'see'?",
                    "answer": "saw"
                },
                {
                    "question": "What is the past tense of 'take'?",
                    "answer": "took"
                },
                {
                    "question": "What is the past tense of 'make'?",
                    "answer": "made"
                },
                {
                    "question": "What is the past tense of 'come'?",
                    "answer": "came"
                },
                {
                    "question": "What is the past tense of 'give'?",
                    "answer": "gave"
                },
                {
                    "question": "What is the past tense of 'write'?",
                    "answer": "wrote"
                },
                {
                    "question": "What is the past tense of 'read'?",
                    "answer": "read"
                },
                {
                    "question": "What is the past tense of 'know'?",
                    "answer": "knew"
                }
            ],
            "sci": [
                {
                    "question": "水の化学式は？",
                    "answer": "H2O"
                },
                {
                    "question": "酸素の化学式は？",
                    "answer": "O2"
                },
                {
                    "question": "二酸化炭素の化学式は？",
                    "answer": "CO2"
                },
                {
                    "question": "水素の化学式は？",
                    "answer": "H2"
                },
                {
                    "question": "窒素の化学式は？",
                    "answer": "N2"
                },
                {
                    "question": "ナトリウムの化学式は？",
                    "answer": "Na"
                },
                {
                    "question": "塩素の化学式は？",
                    "answer": "Cl"
                },
                {
                    "question": "カリウムの化学式は？",
                    "answer": "K"
                },
                {
                    "question": "カルシウムの化学式は？",
                    "answer": "Ca"
                },
                {
                    "question": "鉄の化学式は？",
                    "answer": "Fe"
                }
            ],
            "soc": [
                {
                    "question": "日本の首都は？",
                    "answer": "東京"
                },
                {
                    "question": "アメリカの首都は？",
                    "answer": "ワシントン"
                },
                {
                    "question": "イギリスの首都は？",
                    "answer": "ロンドン"
                },
                {
                    "question": "フランスの首都は？",
                    "answer": "パリ"
                },
                {
                    "question": "ドイツの首都は？",
                    "answer": "ベルリン"
                },
                {
                    "question": "中国の首都は？",
                    "answer": "北京"
                },
                {
                    "question": "韓国の首都は？",
                    "answer": "ソウル"
                },
                {
                    "question": "ロシアの首都は？",
                    "answer": "モスクワ"
                },
                {
                    "question": "イタリアの首都は？",
                    "answer": "ローマ"
                },
                {
                    "question": "スペインの首都は？",
                    "answer": "マドリード"
                }
            ]
        },
        "6": {
            "math": [
                {
                    "question": "√1600 = ?",
                    "answer": "40"
                },
                {
                    "question": "14³ = ?",
                    "answer": "2744"
                },
                {
                    "question": "123 × 4 = ?",
                    "answer": "492"
                },
                {
                    "question": "√1681 = ?",
                    "answer": "41"
                },
                {
                    "question": "15³ = ?",
                    "answer": "3375"
                },
                {
                    "question": "145 × 4 = ?",
                    "answer": "580"
                },
                {
                    "question": "√1764 = ?",
                    "answer": "42"
                },
                {
                    "question": "16³ = ?",
                    "answer": "4096"
                },
                {
                    "question": "167 × 4 = ?",
                    "answer": "668"
                },
                {
                    "question": "√1849 = ?",
                    "answer": "43"
                }
            ],
            "jp": [
                {
                    "question": "「梅」の読み方は？",
                    "answer": "うめ"
                },
                {
                    "question": "「桜」の読み方は？",
                    "answer": "さくら"
                },
                {
                    "question": "「富士」の読み方は？",
                    "answer": "ふじ"
                },
                {
                    "question": "「海」の読み方は？",
                    "answer": "うみ"
                },
                {
                    "question": "「山」の読み方は？",
                    "answer": "やま"
                },
                {
                    "question": "「空」の読み方は？",
                    "answer": "そら"
                },
                {
                    "question": "「川」の読み方は？",
                    "answer": "かわ"
                },
                {
                    "question": "「風」の読み方は？",
                    "answer": "かぜ"
                },
                {
                    "question": "「雨」の読み方は？",
                    "answer": "あめ"
                },
                {
                    "question": "「雪」の読み方は？",
                    "answer": "ゆき"
                }
            ],
            "eng": [
                {
                    "question": "What is the past tense of 'go'?",
                    "answer": "went"
                },
                {
                    "question": "What is the past tense of 'eat'?",
                    "answer": "ate"
                },
                {
                    "question": "What is the past tense of 'see'?",
                    "answer": "saw"
                },
                {
                    "question": "What is the past tense of 'take'?",
                    "answer": "took"
                },
                {
                    "question": "What is the past tense of 'make'?",
                    "answer": "made"
                },
                {
                    "question": "What is the past tense of 'come'?",
                    "answer": "came"
                },
                {
                    "question": "What is the past tense of 'give'?",
                    "answer": "gave"
                },
                {
                    "question": "What is the past tense of 'write'?",
                    "answer": "wrote"
                },
                {
                    "question": "What is the past tense of 'read'?",
                    "answer": "read"
                },
                {
                    "question": "What is the past tense of 'know'?",
                    "answer": "knew"
                }
            ],
            "sci": [
                {
                    "question": "水の化学式は？",
                    "answer": "H2O"
                },
                {
                    "question": "酸素の化学式は？",
                    "answer": "O2"
                },
                {
                    "question": "二酸化炭素の化学式は？",
                    "answer": "CO2"
                },
                {
                    "question": "水素の化学式は？",
                    "answer": "H2"
                },
                {
                    "question": "窒素の化学式は？",
                    "answer": "N2"
                },
                {
                    "question": "ナトリウムの化学式は？",
                    "answer": "Na"
                },
                {
                    "question": "塩素の化学式は？",
                    "answer": "Cl"
                },
                {
                    "question": "カリウムの化学式は？",
                    "answer": "K"
                },
                {
                    "question": "カルシウムの化学式は？",
                    "answer": "Ca"
                },
                {
                    "question": "鉄の化学式は？",
                    "answer": "Fe"
                }
            ],
            "soc": [
                {
                    "question": "日本の首都は？",
                    "answer": "東京"
                },
                {
                    "question": "アメリカの首都は？",
                    "answer": "ワシントン"
                },
                {
                    "question": "イギリスの首都は？",
                    "answer": "ロンドン"
                },
                {
                    "question": "フランスの首都は？",
                    "answer": "パリ"
                },
                {
                    "question": "ドイツの首都は？",
                    "answer": "ベルリン"
                },
                {
                    "question": "中国の首都は？",
                    "answer": "北京"
                },
                {
                    "question": "韓国の首都は？",
                    "answer": "ソウル"
                },
                {
                    "question": "ロシアの首都は？",
                    "answer": "モスクワ"
                },
                {
                    "question": "イタリアの首都は？",
                    "answer": "ローマ"
                },
                {
                    "question": "スペインの首都は？",
                    "answer": "マドリード"
                }
            ]
        },
        "7": {
            "math": [
                {
                    "question": "√1936 = ?",
                    "answer": "44"
                },
                {
                    "question": "17³ = ?",
                    "answer": "4913"
                },
                {
                    "question": "234 × 5 = ?",
                    "answer": "1170"
                },
                {
                    "question": "√2025 = ?",
                    "answer": "45"
                },
                {
                    "question": "18³ = ?",
                    "answer": "5832"
                },
                {
                    "question": "267 × 5 = ?",
                    "answer": "1335"
                },
                {
                    "question": "√2116 = ?",
                    "answer": "46"
                },
                {
                    "question": "19³ = ?",
                    "answer": "6859"
                },
                {
                    "question": "300 × 5 = ?",
                    "answer": "1500"
                },
                {
                    "question": "√2209 = ?",
                    "answer": "47"
                }
            ],
            "jp": [
                {
                    "question": "「梅」の読み方は？",
                    "answer": "うめ"
                },
                {
                    "question": "「桜」の読み方は？",
                    "answer": "さくら"
                },
                {
                    "question": "「富士」の読み方は？",
                    "answer": "ふじ"
                },
                {
                    "question": "「海」の読み方は？",
                    "answer": "うみ"
                },
                {
                    "question": "「山」の読み方は？",
                    "answer": "やま"
                },
                {
                    "question": "「空」の読み方は？",
                    "answer": "そら"
                },
                {
                    "question": "「川」の読み方は？",
                    "answer": "かわ"
                },
                {
                    "question": "「風」の読み方は？",
                    "answer": "かぜ"
                },
                {
                    "question": "「雨」の読み方は？",
                    "answer": "あめ"
                },
                {
                    "question": "「雪」の読み方は？",
                    "answer": "ゆき"
                }
            ],
            "eng": [
                {
                    "question": "What is the past tense of 'go'?",
                    "answer": "went"
                },
                {
                    "question": "What is the past tense of 'eat'?",
                    "answer": "ate"
                },
                {
                    "question": "What is the past tense of 'see'?",
                    "answer": "saw"
                },
                {
                    "question": "What is the past tense of 'take'?",
                    "answer": "took"
                },
                {
                    "question": "What is the past tense of 'make'?",
                    "answer": "made"
                },
                {
                    "question": "What is the past tense of 'come'?",
                    "answer": "came"
                },
                {
                    "question": "What is the past tense of 'give'?",
                    "answer": "gave"
                },
                {
                    "question": "What is the past tense of 'write'?",
                    "answer": "wrote"
                },
                {
                    "question": "What is the past tense of 'read'?",
                    "answer": "read"
                },
                {
                    "question": "What is the past tense of 'know'?",
                    "answer": "knew"
                }
            ],
            "sci": [
                {
                    "question": "水の化学式は？",
                    "answer": "H2O"
                },
                {
                    "question": "酸素の化学式は？",
                    "answer": "O2"
                },
                {
                    "question": "二酸化炭素の化学式は？",
                    "answer": "CO2"
                },
                {
                    "question": "水素の化学式は？",
                    "answer": "H2"
                },
                {
                    "question": "窒素の化学式は？",
                    "answer": "N2"
                },
                {
                    "question": "ナトリウムの化学式は？",
                    "answer": "Na"
                },
                {
                    "question": "塩素の化学式は？",
                    "answer": "Cl"
                },
                {
                    "question": "カリウムの化学式は？",
                    "answer": "K"
                },
                {
                    "question": "カルシウムの化学式は？",
                    "answer": "Ca"
                },
                {
                    "question": "鉄の化学式は？",
                    "answer": "Fe"
                }
            ],
            "soc": [
                {
                    "question": "日本の首都は？",
                    "answer": "東京"
                },
                {
                    "question": "アメリカの首都は？",
                    "answer": "ワシントン"
                },
                {
                    "question": "イギリスの首都は？",
                    "answer": "ロンドン"
                },
                {
                    "question": "フランスの首都は？",
                    "answer": "パリ"
                },
                {
                    "question": "ドイツの首都は？",
                    "answer": "ベルリン"
                },
                {
                    "question": "中国の首都は？",
                    "answer": "北京"
                },
                {
                    "question": "韓国の首都は？",
                    "answer": "ソウル"
                },
                {
                    "question": "ロシアの首都は？",
                    "answer": "モスクワ"
                },
                {
                    "question": "イタリアの首都は？",
                    "answer": "ローマ"
                },
                {
                    "question": "スペインの首都は？",
                    "answer": "マドリード"
                }
            ]
        },
        "8": {
            "math": [
                {
                    "question": "√2304 = ?",
                    "answer": "48"
                },
                {
                    "question": "20³ = ?",
                    "answer": "8000"
                },
                {
                    "question": "345 × 6 = ?",
                    "answer": "2070"
                },
                {
                    "question": "√2401 = ?",
                    "answer": "49"
                },
                {
                    "question": "21³ = ?",
                    "answer": "9261"
                },
                {
                    "question": "378 × 6 = ?",
                    "answer": "2268"
                },
                {
                    "question": "√2500 = ?",
                    "answer": "50"
                },
                {
                    "question": "22³ = ?",
                    "answer": "10648"
                },
                {
                    "question": "411 × 6 = ?",
                    "answer": "2466"
                },
                {
                    "question": "√2601 = ?",
                    "answer": "51"
                }
            ],
            "jp": [
                {
                    "question": "「梅」の読み方は？",
                    "answer": "うめ"
                },
                {
                    "question": "「桜」の読み方は？",
                    "answer": "さくら"
                },
                {
                    "question": "「富士」の読み方は？",
                    "answer": "ふじ"
                },
                {
                    "question": "「海」の読み方は？",
                    "answer": "うみ"
                },
                {
                    "question": "「山」の読み方は？",
                    "answer": "やま"
                },
                {
                    "question": "「空」の読み方は？",
                    "answer": "そら"
                },
                {
                    "question": "「川」の読み方は？",
                    "answer": "かわ"
                },
                {
                    "question": "「風」の読み方は？",
                    "answer": "かぜ"
                },
                {
                    "question": "「雨」の読み方は？",
                    "answer": "あめ"
                },
                {
                    "question": "「雪」の読み方は？",
                    "answer": "ゆき"
                }
            ],
            "eng": [
                {
                    "question": "What is the past tense of 'go'?",
                    "answer": "went"
                },
                {
                    "question": "What is the past tense of 'eat'?",
                    "answer": "ate"
                },
                {
                    "question": "What is the past tense of 'see'?",
                    "answer": "saw"
                },
                {
                    "question": "What is the past tense of 'take'?",
                    "answer": "took"
                },
                {
                    "question": "What is the past tense of 'make'?",
                    "answer": "made"
                },
                {
                    "question": "What is the past tense of 'come'?",
                    "answer": "came"
                },
                {
                    "question": "What is the past tense of 'give'?",
                    "answer": "gave"
                },
                {
                    "question": "What is the past tense of 'write'?",
                    "answer": "wrote"
                },
                {
                    "question": "What is the past tense of 'read'?",
                    "answer": "read"
                },
                {
                    "question": "What is the past tense of 'know'?",
                    "answer": "knew"
                }
            ],
            "sci": [
                {
                    "question": "水の化学式は？",
                    "answer": "H2O"
                },
                {
                    "question": "酸素の化学式は？",
                    "answer": "O2"
                },
                {
                    "question": "二酸化炭素の化学式は？",
                    "answer": "CO2"
                },
                {
                    "question": "水素の化学式は？",
                    "answer": "H2"
                },
                {
                    "question": "窒素の化学式は？",
                    "answer": "N2"
                },
                {
                    "question": "ナトリウムの化学式は？",
                    "answer": "Na"
                },
                {
                    "question": "塩素の化学式は？",
                    "answer": "Cl"
                },
                {
                    "question": "カリウムの化学式は？",
                    "answer": "K"
                },
                {
                    "question": "カルシウムの化学式は？",
                    "answer": "Ca"
                },
                {
                    "question": "鉄の化学式は？",
                    "answer": "Fe"
                }
            ],
            "soc": [
                {
                    "question": "日本の首都は？",
                    "answer": "東京"
                },
                {
                    "question": "アメリカの首都は？",
                    "answer": "ワシントン"
                },
                {
                    "question": "イギリスの首都は？",
                    "answer": "ロンドン"
                },
                {
                    "question": "フランスの首都は？",
                    "answer": "パリ"
                },
                {
                    "question": "ドイツの首都は？",
                    "answer": "ベルリン"
                },
                {
                    "question": "中国の首都は？",
                    "answer": "北京"
                },
                {
                    "question": "韓国の首都は？",
                    "answer": "ソウル"
                },
                {
                    "question": "ロシアの首都は？",
                    "answer": "モスクワ"
                },
                {
                    "question": "イタリアの首都は？",
                    "answer": "ローマ"
                },
                {
                    "question": "スペインの首都は？",
                    "answer": "マドリード"
                }
            ]
        },
        "9": {
            "math": [
                {
                    "question": "√2704 = ?",
                    "answer": "52"
                },
                {
                    "question": "23³ = ?",
                    "answer": "12167"
                },
                {
                    "question": "456 × 7 = ?",
                    "answer": "3192"
                },
                {
                    "question": "√2809 = ?",
                    "answer": "53"
                },
                {
                    "question": "24³ = ?",
                    "answer": "13824"
                },
                {
                    "question": "489 × 7 = ?",
                    "answer": "3423"
                },
                {
                    "question": "√2916 = ?",
                    "answer": "54"
                },
                {
                    "question": "25³ = ?",
                    "answer": "15625"
                },
                {
                    "question": "522 × 7 = ?",
                    "answer": "3654"
                },
                {
                    "question": "√3025 = ?",
                    "answer": "55"
                }
            ],
            "jp": [
                {
                    "question": "「梅」の読み方は？",
                    "answer": "うめ"
                },
                {
                    "question": "「桜」の読み方は？",
                    "answer": "さくら"
                },
                {
                    "question": "「富士」の読み方は？",
                    "answer": "ふじ"
                },
                {
                    "question": "「海」の読み方は？",
                    "answer": "うみ"
                },
                {
                    "question": "「山」の読み方は？",
                    "answer": "やま"
                },
                {
                    "question": "「空」の読み方は？",
                    "answer": "そら"
                },
                {
                    "question": "「川」の読み方は？",
                    "answer": "かわ"
                },
                {
                    "question": "「風」の読み方は？",
                    "answer": "かぜ"
                },
                {
                    "question": "「雨」の読み方は？",
                    "answer": "あめ"
                },
                {
                    "question": "「雪」の読み方は？",
                    "answer": "ゆき"
                }
            ],
            "eng": [
                {
                    "question": "What is the past tense of 'go'?",
                    "answer": "went"
                },
                {
                    "question": "What is the past tense of 'eat'?",
                    "answer": "ate"
                },
                {
                    "question": "What is the past tense of 'see'?",
                    "answer": "saw"
                },
                {
                    "question": "What is the past tense of 'take'?",
                    "answer": "took"
                },
                {
                    "question": "What is the past tense of 'make'?",
                    "answer": "made"
                },
                {
                    "question": "What is the past tense of 'come'?",
                    "answer": "came"
                },
                {
                    "question": "What is the past tense of 'give'?",
                    "answer": "gave"
                },
                {
                    "question": "What is the past tense of 'write'?",
                    "answer": "wrote"
                },
                {
                    "question": "What is the past tense of 'read'?",
                    "answer": "read"
                },
                {
                    "question": "What is the past tense of 'know'?",
                    "answer": "knew"
                }
            ],
            "sci": [
                {
                    "question": "水の化学式は？",
                    "answer": "H2O"
                },
                {
                    "question": "酸素の化学式は？",
                    "answer": "O2"
                },
                {
                    "question": "二酸化炭素の化学式は？",
                    "answer": "CO2"
                },
                {
                    "question": "水素の化学式は？",
                    "answer": "H2"
                },
                {
                    "question": "窒素の化学式は？",
                    "answer": "N2"
                },
                {
                    "question": "ナトリウムの化学式は？",
                    "answer": "Na"
                },
                {
                    "question": "塩素の化学式は？",
                    "answer": "Cl"
                },
                {
                    "question": "カリウムの化学式は？",
                    "answer": "K"
                },
                {
                    "question": "カルシウムの化学式は？",
                    "answer": "Ca"
                },
                {
                    "question": "鉄の化学式は？",
                    "answer": "Fe"
                }
            ],
            "soc": [
                {
                    "question": "日本の首都は？",
                    "answer": "東京"
                },
                {
                    "question": "アメリカの首都は？",
                    "answer": "ワシントン"
                },
                {
                    "question": "イギリスの首都は？",
                    "answer": "ロンドン"
                },
                {
                    "question": "フランスの首都は？",
                    "answer": "パリ"
                },
                {
                    "question": "ドイツの首都は？",
                    "answer": "ベルリン"
                },
                {
                    "question": "中国の首都は？",
                    "answer": "北京"
                },
                {
                    "question": "韓国の首都は？",
                    "answer": "ソウル"
                },
                {
                    "question": "ロシアの首都は？",
                    "answer": "モスクワ"
                },
                {
                    "question": "イタリアの首都は？",
                    "answer": "ローマ"
                },
                {
                    "question": "スペインの首都は？",
                    "answer": "マドリード"
                }
            ]
        },
        "10": {
            "math": [
                {
                    "question": "√3136 = ?",
                    "answer": "56"
                },
                {
                    "question": "26³ = ?",
                    "answer": "17576"
                },
                {
                    "question": "567 × 8 = ?",
                    "answer": "4536"
                },
                {
                    "question": "√3249 = ?",
                    "answer": "57"
                },
                {
                    "question": "27³ = ?",
                    "answer": "19683"
                },
                {
                    "question": "600 × 8 = ?",
                    "answer": "4800"
                },
                {
                    "question": "√3364 = ?",
                    "answer": "58"
                },
                {
                    "question": "28³ = ?",
                    "answer": "21952"
                },
                {
                    "question": "633 × 8 = ?",
                    "answer": "5064"
                },
                {
                    "question": "√3481 = ?",
                    "answer": "59"
                }
            ],
            "jp": [
                {
                    "question": "「梅」の読み方は？",
                    "answer": "うめ"
                },
                {
                    "question": "「桜」の読み方は？",
                    "answer": "さくら"
                },
                {
                    "question": "「富士」の読み方は？",
                    "answer": "ふじ"
                },
                {
                    "question": "「海」の読み方は？",
                    "answer": "うみ"
                },
                {
                    "question": "「山」の読み方は？",
                    "answer": "やま"
                },
                {
                    "question": "「空」の読み方は？",
                    "answer": "そら"
                },
                {
                    "question": "「川」の読み方は？",
                    "answer": "かわ"
                },
                {
                    "question": "「風」の読み方は？",
                    "answer": "かぜ"
                },
                {
                    "question": "「雨」の読み方は？",
                    "answer": "あめ"
                },
                {
                    "question": "「雪」の読み方は？",
                    "answer": "ゆき"
                }
            ],
            "eng": [
                {
                    "question": "What is the past tense of 'go'?",
                    "answer": "went"
                },
                {
                    "question": "What is the past tense of 'eat'?",
                    "answer": "ate"
                },
                {
                    "question": "What is the past tense of 'see'?",
                    "answer": "saw"
                },
                {
                    "question": "What is the past tense of 'take'?",
                    "answer": "took"
                },
                {
                    "question": "What is the past tense of 'make'?",
                    "answer": "made"
                },
                {
                    "question": "What is the past tense of 'come'?",
                    "answer": "came"
                },
                {
                    "question": "What is the past tense of 'give'?",
                    "answer": "gave"
                },
                {
                    "question": "What is the past tense of 'write'?",
                    "answer": "wrote"
                },
                {
                    "question": "What is the past tense of 'read'?",
                    "answer": "read"
                },
                {
                    "question": "What is the past tense of 'know'?",
                    "answer": "knew"
                }
            ],
            "sci": [
                {
                    "question": "水の化学式は？",
                    "answer": "H2O"
                },
                {
                    "question": "酸素の化学式は？",
                    "answer": "O2"
                },
                {
                    "question": "二酸化炭素の化学式は？",
                    "answer": "CO2"
                },
                {
                    "question": "水素の化学式は？",
                    "answer": "H2"
                },
                {
                    "question": "窒素の化学式は？",
                    "answer": "N2"
                },
                {
                    "question": "ナトリウムの化学式は？",
                    "answer": "Na"
                },
                {
                    "question": "塩素の化学式は？",
                    "answer": "Cl"
                },
                {
                    "question": "カリウムの化学式は？",
                    "answer": "K"
                },
                {
                    "question": "カルシウムの化学式は？",
                    "answer": "Ca"
                },
                {
                    "question": "鉄の化学式は？",
                    "answer": "Fe"
                }
            ],
            "soc": [
                {
                    "question": "日本の首都は？",
                    "answer": "東京"
                },
                {
                    "question": "アメリカの首都は？",
                    "answer": "ワシントン"
                },
                {
                    "question": "イギリスの首都は？",
                    "answer": "ロンドン"
                },
                {
                    "question": "フランスの首都は？",
                    "answer": "パリ"
                },
                {
                    "question": "ドイツの首都は？",
                    "answer": "ベルリン"
                },
                {
                    "question": "中国の首都は？",
                    "answer": "北京"
                },
                {
                    "question": "韓国の首都は？",
                    "answer": "ソウル"
                },
                {
                    "question": "ロシアの首都は？",
                    "answer": "モスクワ"
                },
                {
                    "question": "イタリアの首都は？",
                    "answer": "ローマ"
                },
                {
                    "question": "スペインの首都は？",
                    "answer": "マドリード"
                }
            ]
        },
        "11": {
            "math": [
                {
                    "question": "√3600 = ?",
                    "answer": "60"
                },
                {
                    "question": "29³ = ?",
                    "answer": "24389"
                },
                {
                    "question": "678 × 9 = ?",
                    "answer": "6102"
                },
                {
                    "question": "√3721 = ?",
                    "answer": "61"
                },
                {
                    "question": "30³ = ?",
                    "answer": "27000"
                },
                {
                    "question": "711 × 9 = ?",
                    "answer": "6399"
                },
                {
                    "question": "√3844 = ?",
                    "answer": "62"
                },
                {
                    "question": "31³ = ?",
                    "answer": "29791"
                },
                {
                    "question": "744 × 9 = ?",
                    "answer": "6696"
                },
                {
                    "question": "√3969 = ?",
                    "answer": "63"
                }
            ],
            "jp": [
                {
                    "question": "「梅」の読み方は？",
                    "answer": "うめ"
                },
                {
                    "question": "「桜」の読み方は？",
                    "answer": "さくら"
                },
                {
                    "question": "「富士」の読み方は？",
                    "answer": "ふじ"
                },
                {
                    "question": "「海」の読み方は？",
                    "answer": "うみ"
                },
                {
                    "question": "「山」の読み方は？",
                    "answer": "やま"
                },
                {
                    "question": "「空」の読み方は？",
                    "answer": "そら"
                },
                {
                    "question": "「川」の読み方は？",
                    "answer": "かわ"
                },
                {
                    "question": "「風」の読み方は？",
                    "answer": "かぜ"
                },
                {
                    "question": "「雨」の読み方は？",
                    "answer": "あめ"
                },
                {
                    "question": "「雪」の読み方は？",
                    "answer": "ゆき"
                }
            ],
            "eng": [
                {
                    "question": "What is the past tense of 'go'?",
                    "answer": "went"
                },
                {
                    "question": "What is the past tense of 'eat'?",
                    "answer": "ate"
                },
                {
                    "question": "What is the past tense of 'see'?",
                    "answer": "saw"
                },
                {
                    "question": "What is the past tense of 'take'?",
                    "answer": "took"
                },
                {
                    "question": "What is the past tense of 'make'?",
                    "answer": "made"
                },
                {
                    "question": "What is the past tense of 'come'?",
                    "answer": "came"
                },
                {
                    "question": "What is the past tense of 'give'?",
                    "answer": "gave"
                },
                {
                    "question": "What is the past tense of 'write'?",
                    "answer": "wrote"
                },
                {
                    "question": "What is the past tense of 'read'?",
                    "answer": "read"
                },
                {
                    "question": "What is the past tense of 'know'?",
                    "answer": "knew"
                }
            ],
            "sci": [
                {
                    "question": "水の化学式は？",
                    "answer": "H2O"
                },
                {
                    "question": "酸素の化学式は？",
                    "answer": "O2"
                },
                {
                    "question": "二酸化炭素の化学式は？",
                    "answer": "CO2"
                },
                {
                    "question": "水素の化学式は？",
                    "answer": "H2"
                },
                {
                    "question": "窒素の化学式は？",
                    "answer": "N2"
                },
                {
                    "question": "ナトリウムの化学式は？",
                    "answer": "Na"
                },
                {
                    "question": "塩素の化学式は？",
                    "answer": "Cl"
                },
                {
                    "question": "カリウムの化学式は？",
                    "answer": "K"
                },
                {
                    "question": "カルシウムの化学式は？",
                    "answer": "Ca"
                },
                {
                    "question": "鉄の化学式は？",
                    "answer": "Fe"
                }
            ],
            "soc": [
                {
                    "question": "日本の首都は？",
                    "answer": "東京"
                },
                {
                    "question": "アメリカの首都は？",
                    "answer": "ワシントン"
                },
                {
                    "question": "イギリスの首都は？",
                    "answer": "ロンドン"
                },
                {
                    "question": "フランスの首都は？",
                    "answer": "パリ"
                },
                {
                    "question": "ドイツの首都は？",
                    "answer": "ベルリン"
                },
                {
                    "question": "中国の首都は？",
                    "answer": "北京"
                },
                {
                    "question": "韓国の首都は？",
                    "answer": "ソウル"
                },
                {
                    "question": "ロシアの首都は？",
                    "answer": "モスクワ"
                },
                {
                    "question": "イタリアの首都は？",
                    "answer": "ローマ"
                },
                {
                    "question": "スペインの首都は？",
                    "answer": "マドリード"
                }
            ]
        },
        "12": {
            "math": [
                {
                    "question": "√4096 = ?",
                    "answer": "64"
                },
                {
                    "question": "32³ = ?",
                    "answer": "32768"
                },
                {
                    "question": "789 × 10 = ?",
                    "answer": "7890"
                },
                {
                    "question": "√4225 = ?",
                    "answer": "65"
                },
                {
                    "question": "33³ = ?",
                    "answer": "35937"
                },
                {
                    "question": "822 × 10 = ?",
                    "answer": "8220"
                },
                {
                    "question": "√4356 = ?",
                    "answer": "66"
                },
                {
                    "question": "34³ = ?",
                    "answer": "39304"
                },
                {
                    "question": "855 × 10 = ?",
                    "answer": "8550"
                },
                {
                    "question": "√4489 = ?",
                    "answer": "67"
                }
            ],
            "jp": [
                {
                    "question": "「梅」の読み方は？",
                    "answer": "うめ"
                },
                {
                    "question": "「桜」の読み方は？",
                    "answer": "さくら"
                },
                {
                    "question": "「富士」の読み方は？",
                    "answer": "ふじ"
                },
                {
                    "question": "「海」の読み方は？",
                    "answer": "うみ"
                },
                {
                    "question": "「山」の読み方は？",
                    "answer": "やま"
                },
                {
                    "question": "「空」の読み方は？",
                    "answer": "そら"
                },
                {
                    "question": "「川」の読み方は？",
                    "answer": "かわ"
                },
                {
                    "question": "「風」の読み方は？",
                    "answer": "かぜ"
                },
                {
                    "question": "「雨」の読み方は？",
                    "answer": "あめ"
                },
                {
                    "question": "「雪」の読み方は？",
                    "answer": "ゆき"
                }
            ],
            "eng": [
                {
                    "question": "What is the past tense of 'go'?",
                    "answer": "went"
                },
                {
                    "question": "What is the past tense of 'eat'?",
                    "answer": "ate"
                },
                {
                    "question": "What is the past tense of 'see'?",
                    "answer": "saw"
                },
                {
                    "question": "What is the past tense of 'take'?",
                    "answer": "took"
                },
                {
                    "question": "What is the past tense of 'make'?",
                    "answer": "made"
                },
                {
                    "question": "What is the past tense of 'come'?",
                    "answer": "came"
                },
                {
                    "question": "What is the past tense of 'give'?",
                    "answer": "gave"
                },
                {
                    "question": "What is the past tense of 'write'?",
                    "answer": "wrote"
                },
                {
                    "question": "What is the past tense of 'read'?",
                    "answer": "read"
                },
                {
                    "question": "What is the past tense of 'know'?",
                    "answer": "knew"
                }
            ],
            "sci": [
                {
                    "question": "水の化学式は？",
                    "answer": "H2O"
                },
                {
                    "question": "酸素の化学式は？",
                    "answer": "O2"
                },
                {
                    "question": "二酸化炭素の化学式は？",
                    "answer": "CO2"
                },
                {
                    "question": "水素の化学式は？",
                    "answer": "H2"
                },
                {
                    "question": "窒素の化学式は？",
                    "answer": "N2"
                },
                {
                    "question": "ナトリウムの化学式は？",
                    "answer": "Na"
                },
                {
                    "question": "塩素の化学式は？",
                    "answer": "Cl"
                },
                {
                    "question": "カリウムの化学式は？",
                    "answer": "K"
                },
                {
                    "question": "カルシウムの化学式は？",
                    "answer": "Ca"
                },
                {
                    "question": "鉄の化学式は？",
                    "answer": "Fe"
                }
            ],
            "soc": [
                {
                    "question": "日本の首都は？",
                    "answer": "東京"
                },
                {
                    "question": "アメリカの首都は？",
                    "answer": "ワシントン"
                },
                {
                    "question": "イギリスの首都は？",
                    "answer": "ロンドン"
                },
                {
                    "question": "フランスの首都は？",
                    "answer": "パリ"
                },
                {
                    "question": "ドイツの首都は？",
                    "answer": "ベルリン"
                },
                {
                    "question": "中国の首都は？",
                    "answer": "北京"
                },
                {
                    "question": "韓国の首都は？",
                    "answer": "ソウル"
                },
                {
                    "question": "ロシアの首都は？",
                    "answer": "モスクワ"
                },
                {
                    "question": "イタリアの首都は？",
                    "answer": "ローマ"
                },
                {
                    "question": "スペインの首都は？",
                    "answer": "マドリード"
                }
            ]
        }
    }
};
