import { PresentationData } from "./presentation-schema";
import { alceoDesignSystem } from "./presentation-design-systems";

export const alceoSamplePresentation: PresentationData = {
  designSystem: alceoDesignSystem,
  metadata: {
    title: "Alceo - Innovation Design Partner",
    subtitle: "ビジネス × デザイン × テクノロジーの高度融合",
    targetAudience:
      "デジタルトランスフォーメーションを推進する企業の経営層・事業責任者。特に金融業界を中心に、サービス開発やUX改善に課題を持つ意思決定者。",
    purpose:
      "Alceoの総合的なデザインコンサルティング能力と、Simplexグループのエコシステムを活かした戦略〜開発〜運用の一貫支援体制を訴求する。定量データと具体事例で信頼を獲得し、初回商談の設定につなげる。",
    keyMessages: [
      "DXプロジェクトの成否を分けるのはテクノロジーではなく「デザイン」である",
      "戦略・設計・実装・運用を一社で完結——つくって終わりではなく、育てるところまで伴走する",
      "金融の現場で積み上げた実績が、机上では出せない提案精度になる",
      "Simplexグループのエコシステムが、デザインファームだけでは届かない実行力を支える",
      "まずはあなたの課題を聞かせてください——初回対話から具体的な次の一手をお出しします",
    ],
    author: "Alceo Sales Team",
    date: "2026-03",
  },
  theme: {
    primaryColor: "#0E1410",
    secondaryColor: "#2B3D33",
    accentColor: "#38B48B",
    backgroundColor: "#F4F1EE",
    textColor: "#0E1410",
  },
  outline: [
    {
      id: "sec-1",
      title: "イントロダクション",
      points: ["タイトル", "エグゼクティブサマリー", "ミッション"],
      slideIds: ["slide-1", "slide-2", "slide-3"],
    },
    {
      id: "sec-2",
      title: "課題提起 — なぜデザインが不可欠か",
      points: [
        "DXの現実：70%が期待成果に未達",
        "デザイン投資と業績の相関",
        "典型的な3つの失敗パターン",
      ],
      slideIds: ["slide-4", "slide-5", "slide-6"],
    },
    {
      id: "sec-3",
      title: "Alceoのアプローチ",
      points: [
        "5つのサービスラインの全体像",
        "9フェーズの一貫プロセス",
        "エビデンスベースの実績数値",
      ],
      slideIds: ["slide-7", "slide-8", "slide-9"],
    },
    {
      id: "sec-4",
      title: "実績 — 数字が証明する成果",
      points: [
        "金融機関A社：モバイルバンキング刷新",
        "証券会社B社：トレーディングUX改革",
      ],
      slideIds: ["slide-10", "slide-11", "slide-12"],
    },
    {
      id: "sec-5",
      title: "Simplexグループの総合力",
      points: ["グループ4社の専門性", "ワンストップ支援体制"],
      slideIds: ["slide-13", "slide-14"],
    },
    {
      id: "sec-6",
      title: "チーム・カルチャー",
      points: ["マルチディシプリナリーチーム", "7つのバリュー"],
      slideIds: ["slide-15"],
    },
    {
      id: "sec-7",
      title: "クロージング",
      points: ["次のステップ"],
      slideIds: ["slide-16"],
    },
  ],
  slides: [
    {
      id: "slide-1",
      sectionId: "sec-1",
      layout: "title",
      title: "Alceo",
      subtitle: "Innovation Design Partner",
      backgroundImage: "/presentation/ps_alceo_demo_slide-1.jpg",
      backgroundOverlay: "rgba(14,20,16,0.55)",
      body: {
        type: "title",
        tagline:
          "Design the Innovation, Fly the Business, Change the Society.",
        description:
          "ビジネス × デザイン × テクノロジーを高度に融合し、\nイノベーションを共創するデザインパートナー",
      },
    },
    {
      id: "slide-2",
      sectionId: "sec-1",
      layout: "bullets",
      title: "デザインの力で、DXを事業成果に変える",
      subtitle: "Executive Summary",
      body: {
        type: "bullets",
        items: [
          {
            text: "DXプロジェクトの70%は期待成果に未達。成否を分けるのは「ユーザー起点のデザイン」である",
          },
          {
            text: "Alceoは戦略→設計→実装→運用→グロースを一気通貫で支援する、唯一のデザインパートナー",
          },
          {
            text: "金融業界を中心に、申込完了率+32%、開発手戻り60%削減などの定量成果を実現",
          },
          {
            text: "Simplexグループ4社の総合力で、デザインファーム単体では届かない実行力を提供",
          },
        ],
      },
      notes:
        "冒頭30秒で全体像を伝える。忙しい経営層はここで興味の有無を判断する。",
    },
    {
      id: "slide-3",
      sectionId: "sec-1",
      layout: "quote",
      title: "美と機能の融合が、私たちの原点である",
      body: {
        type: "quote",
        quote:
          "Useful and Beautiful — 機能性と美しさの調和を追求し、社会にインパクトのあるイノベーションをデザインする",
        attribution: "Alceo Design Philosophy",
        context:
          "カワセミ（学名: Alcedo atthis）の構造色の美しさと空力学的なくちばしのフォルムが象徴する、美と機能の融合がAlceoの原点です。",
      },
    },
    {
      id: "slide-4",
      sectionId: "sec-2",
      layout: "section-divider",
      title: "DXの現実",
      subtitle: "なぜ多くのプロジェクトが期待成果に届かないのか",
      backgroundImage: "/presentation/ps_alceo_demo_slide-4.jpg",
      backgroundOverlay: "rgba(14,20,16,0.60)",
    },
    {
      id: "slide-5",
      sectionId: "sec-2",
      layout: "stats",
      title: "DXプロジェクトの70%は期待した成果に到達しない",
      subtitle: "業界データが示すデザイン投資の重要性",
      body: {
        type: "stats",
        stats: [
          {
            value: "70%",
            label: "DX未達率",
            description:
              "BCG調査: DXプロジェクトの大半が期待ROIに未達",
          },
          {
            value: "2x",
            label: "売上成長率",
            description:
              "McKinsey調査: デザイン投資上位企業は同業他社の2倍成長",
          },
          {
            value: "56%",
            label: "手戻りコスト",
            description:
              "リリース後の手戻りが総開発コストの過半を占める",
          },
        ],
        footnote:
          "出典: BCG 'Digital Transformation Survey 2024', McKinsey 'The Business Value of Design 2018'",
      },
      notes:
        "数字のインパクトで聴衆を引き込む。自社の話をする前に、業界の現実を客観的に示す。",
    },
    {
      id: "slide-6",
      sectionId: "sec-2",
      layout: "bullets",
      title: "失敗するDXには共通する3つのパターンがある",
      subtitle: "技術は揃っている。足りないのはデザインである",
      body: {
        type: "bullets",
        items: [
          {
            text: "ユーザー不在の開発 — 技術先行で「使われない」プロダクトが生まれる",
            subItems: [
              "PoC段階でユーザー検証がなく、リリース後に大幅な方針転換",
            ],
          },
          {
            text: "戦略とUIの分断 — ビジネス戦略がインターフェースに反映されない",
            subItems: [
              "経営が描いた顧客体験が、開発現場で別物になる",
            ],
          },
          {
            text: "リリースして終わり — 継続的な改善の仕組みがない",
            subItems: [
              "ユーザーデータを取得・分析する体制がなく、改善が属人的",
            ],
          },
        ],
      },
      notes:
        "聴衆に「これはうちのことだ」と思わせることが目的。具体的な事例を添えて話す。",
    },
    {
      id: "slide-7",
      sectionId: "sec-3",
      layout: "section-divider",
      title: "Alceoのアプローチ",
      subtitle: "戦略から運用まで、デザインで事業成果を出す",
      backgroundImage: "/presentation/ps_alceo_demo_slide-7.jpg",
      backgroundOverlay: "rgba(14,20,16,0.55)",
    },
    {
      id: "slide-8",
      sectionId: "sec-3",
      layout: "two-column",
      title:
        "5つのサービスラインが、戦略から改善まで全フェーズをカバーする",
      body: {
        type: "two-column",
        left: {
          heading: "上流: 構想・企画",
          items: [
            "Business & Service Design — 事業戦略を体験に翻訳する",
            "Brand Design — 企業の意志をビジュアルで体現する",
            "Human Resource Development — 組織にデザイン力を根づかせる",
          ],
        },
        right: {
          heading: "下流: 実装・成長",
          items: [
            "Digital Product Design — 9フェーズ一貫プロセスでつくりきる",
            "Growth Design — データに基づき育て続ける",
          ],
        },
      },
    },
    {
      id: "slide-9",
      sectionId: "sec-3",
      layout: "stats",
      title:
        "体系的なプロセスと専門チームが、再現性のある成果を生む",
      body: {
        type: "stats",
        stats: [
          {
            value: "9",
            label: "フェーズ",
            description:
              "リサーチ→定義→設計→検証→開発→リリースまで体系化",
          },
          {
            value: "40+",
            label: "専門人材",
            description:
              "UXリサーチャー、UIデザイナー、PM、エンジニアが連携",
          },
          {
            value: "100%",
            label: "内製チーム",
            description: "外部委託ゼロ。品質とスピードを両立",
          },
        ],
        footnote:
          "Design Research、Design Sprint、UX Audit、Usability Testing等の専門メソッドを体系的に適用",
      },
    },
    {
      id: "slide-10",
      sectionId: "sec-4",
      layout: "section-divider",
      title: "実績",
      subtitle: "数字が証明する、デザインの事業インパクト",
      backgroundImage: "/presentation/ps_alceo_demo_slide-10.jpg",
      backgroundOverlay: "rgba(14,20,16,0.50)",
    },
    {
      id: "slide-11",
      sectionId: "sec-4",
      layout: "image-text",
      title: "モバイルバンキング刷新で申込完了率が32%向上",
      subtitle: "大手金融機関A社",
      backgroundImage: "/presentation/ps_alceo_demo_slide-11.jpg",
      body: {
        type: "image-text",
        imagePosition: "left",
        text: "課題: モバイルアプリの申込離脱率が業界平均を大幅に上回り、UI改修を3回実施するも改善せず。\n\n成果（6ヶ月）:\n・申込完了率 +32%（業界トップ水準へ）\n・ユーザー満足度 NPS +18pt改善\n・開発手戻り 60%削減",
      },
      notes:
        "Alceoのアプローチ: ユーザビリティテスト→課題構造化→プロトタイプ検証→段階的リリース。3ヶ月で初期成果を出し、6ヶ月で本格展開。",
    },
    {
      id: "slide-12",
      sectionId: "sec-4",
      layout: "image-text",
      title: "トレーディングUX改革で約定処理時間を40%短縮",
      subtitle: "証券会社B社",
      backgroundImage: "/presentation/ps_alceo_demo_slide-12.jpg",
      body: {
        type: "image-text",
        imagePosition: "left",
        text: "課題: プロトレーダーが複数画面を切り替える非効率なUI。競合他社のUI刷新により顧客流出リスクが顕在化。\n\n成果（9ヶ月）:\n・約定処理時間 40%短縮\n・操作ミス率 73%削減\n・新規口座開設 前年同期比 +15%",
      },
      notes:
        "金融の深い業務知識を持つAlceoだからこそ実現できた事例。トレーダーへの密着調査から始め、業務フローを根本から再設計。",
    },
    {
      id: "slide-13",
      sectionId: "sec-5",
      layout: "two-column",
      title:
        "Simplexグループ4社が、構想から運用まで一貫して支える",
      subtitle: "ビジネス × デザイン × テクノロジー × AI",
      body: {
        type: "two-column",
        left: {
          heading: "グループ各社の専門性",
          items: [
            "Xspear Consulting — 経営戦略・業務改革",
            "Alceo — イノベーションデザイン",
            "Simplex — 大規模システム開発・運用",
            "Deep Percept — AI・機械学習・データ分析",
          ],
        },
        right: {
          heading: "お客様が得られる価値",
          items: [
            "戦略〜開発〜運用のワンストップ支援",
            "各領域の専門家がプロジェクト初日から参画",
            "技術的実現性を織り込んだデザイン提案",
            "AI活用を前提とした次世代UX設計",
          ],
        },
      },
    },
    {
      id: "slide-14",
      sectionId: "sec-5",
      layout: "stats",
      title:
        "グループの総合力が、デザインファーム単体では届かない規模感を実現する",
      body: {
        type: "stats",
        stats: [
          {
            value: "3,000+",
            label: "グループ社員数",
            description:
              "エンジニア・コンサルタント・デザイナーの総合力",
          },
          {
            value: "25年+",
            label: "金融業界実績",
            description:
              "メガバンク・証券・保険の主要プレイヤーを支援",
          },
          {
            value: "東証プライム",
            label: "上場企業グループ",
            description: "安定した経営基盤と長期的パートナーシップ",
          },
        ],
      },
    },
    {
      id: "slide-15",
      sectionId: "sec-6",
      layout: "two-column",
      title: "多様な専門性を持つチームが、一つの目標に向かう",
      body: {
        type: "two-column",
        left: {
          heading: "チーム構成",
          items: [
            "UXデザイナー / UXリサーチャー",
            "UIデザイナー / ビジュアルデザイナー",
            "プロダクトマネージャー",
            "フロントエンドエンジニア",
            "ブランドデザイナー",
          ],
        },
        right: {
          heading: "7 Values",
          items: [
            "Be Sharp, Be Logical — 無駄のない論理的思考",
            "God is in the Details — 細部へのこだわり",
            "Mutual Respect — 多様性の尊重",
            "Borderless — 職種を超える統合力",
            "Useful and Beautiful — 機能と美の調和",
          ],
        },
      },
    },
    {
      id: "slide-16",
      sectionId: "sec-7",
      layout: "cta",
      title: "次のステップ",
      body: {
        type: "cta",
        heading: "まず60分、貴社の課題をお聞かせください",
        description:
          "初回ヒアリングでは、貴社のDX推進状況を伺い、Alceoが提供できる具体的な価値と、最初の3ヶ月で実現可能な成果イメージをお示しします。",
        actions: [
          "初回ヒアリング（無料・60分）— 課題の構造化と優先順位の整理",
          "クイックUX診断（2週間）— 既存サービスの改善ポイントを可視化",
          "デザインスプリント（1週間）— プロトタイプで仮説を高速検証",
        ],
        contactInfo: "https://alceo.simplex.inc/contact/",
      },
      notes:
        "具体的なアクションと期間を提示することで、「何が起きるか」をイメージさせる。曖昧な「お気軽にご相談ください」は避ける。",
    },
  ],
};
