import Icon from "./Icon";

export function Shell({ tab, onTab, children }) {
  return (
    <>
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src="/assets/logo.svg" alt="" />
          <div>
            画活了<small>LITTLE ART, BIG STORIES</small>
          </div>
        </div>
        <div className="side-label">每一笔，都值得被记住</div>
        <nav className="nav">
          {[
            ["album", "我的画册", "album"],
            ["read", "一起读", "book"],
            ["me", "我的", "user"],
          ].map(([id, title, icon], index) => (
            <button
              key={id}
              onClick={() => onTab(id)}
              className={tab === id ? "active" : ""}
            >
              <Icon name={icon} />
              {title}
              <span>0{index + 1}</span>
            </button>
          ))}
        </nav>
        <div className="side-note">
          <div className="sprout">
            <Icon size={33} />
          </div>
          不着急长大，
          <br />
          先把想象留下来。
        </div>
        <div className="profile">
          <div className="avatar">
            <Icon name="user" size={19} />
          </div>
          <div>
            <strong>小小收藏家</strong>
            <small>我们的画册</small>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span className="topbar-brand">
            <img src="/assets/logo.svg" alt="" width="28" height="28" />
            画活了 <span style={{ margin: "0 12px", color: "#c0c3b4" }}>
              /
            </span>{" "}
            {tab === "album" ? "我的画册" : tab === "read" ? "一起读" : "我的"}
          </span>
          <div className="lock">
            <Icon name="lock" size={13} /> 无需注册
          </div>
        </header>
        {children}
        <footer className="footer">
          <span>画活了 · 每一幅画，都是一个小小世界</span>
          <span>用想象，收藏童年</span>
        </footer>
      </main>
    </>
  );
}

export function Gallery({
  items,
  tab,
  filter,
  setFilter,
  sort,
  setSort,
  onNew,
  onSample,
  onDetail,
  onAlbum,
  ready,
}) {
  const visible = items
    .filter((i) =>
      tab === "read"
        ? i.story?.ready
        : filter === "story"
          ? i.story?.ready
          : filter === "original"
            ? !i.story?.ready
            : true,
    )
    .sort((a, b) =>
      sort === "new"
        ? b.date.localeCompare(a.date)
        : a.date.localeCompare(b.date),
    );
  return (
    <>
      <section className="page-head">
        <div>
          <div className="eyebrow">
            {tab === "read" ? "A LITTLE STORY TIME" : "THE LITTLE GALLERY"}
          </div>
          <h1>{tab === "read" ? "把故事，再读一遍" : "小小画册，大大世界"}</h1>
          <p>
            {tab === "read"
              ? "靠近一点，听听画里的小小冒险。"
              : "收藏孩子的每一笔，也收藏每一笔背后的奇思妙想。"}
          </p>
        </div>
        <button className="primary" onClick={onNew} disabled={!ready}>
          <Icon name="plus" size={17} /> 留下一幅画
        </button>
      </section>
      {tab === "album" && (
        <section className="hero">
          <div>
            <div className="hero-tag">
              <Icon name="spark" size={13} /> 从一幅画，到一个故事
            </div>
            <h2>
              那些天马行空，
              <br />
              值得有一个小小的后来。
            </h2>
            <p>
              拍下孩子的画，听听他的想法，
              <br />
              一起做成可以反复翻阅的故事。
            </p>
            <button className="text-btn" onClick={onSample} disabled={!ready}>
              翻开四页示例 <Icon name="arrow" size={15} />
            </button>
          </div>
          <div className="hero-art">
            <div className="paper">
              <img src="/assets/dog.svg" alt="手绘蓝色小狗示例" />
              <small>一幅小画</small>
            </div>
            <div className="paper two">
              <img src="/assets/story-3.svg" alt="月亮下的小狗故事示例" />
              <small>一场小小冒险</small>
            </div>
            <span className="doodle">✧</span>
            <span className="tiny-note">让想象，轻轻翻一页 ↗</span>
          </div>
        </section>
      )}
      <div className="section-bar">
        <div className="filters">
          {tab === "album" ? (
            ["all", "story", "original"].map((value, index) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={filter === value ? "active" : ""}
              >
                {["全部作品", "有故事的画", "原画记录"][index]}
                {value === "all" && <em>{items.length}</em>}
              </button>
            ))
          ) : (
            <button className="active">
              我们的故事 <em>{visible.length}</em>
            </button>
          )}
        </div>
        <select
          className="sort"
          aria-label="作品排序"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="new">最新收藏优先</option>
          <option value="old">最早收藏优先</option>
        </select>
      </div>
      {ready && (
        <>
          <section className="cards">
            {visible.length ? (
              visible.map((item) => (
                <button
                  className="card"
                  key={item.id}
                  onClick={() => onDetail(item.id)}
                >
                  <div className="art-wrap">
                    <img src={item.image} alt={item.title} loading="lazy" />
                    <span
                      className={`badge ${item.story?.ready ? "" : "neutral"}`}
                    >
                      <Icon
                        name={
                          item.story?.ready
                            ? "book"
                            : item.job
                              ? "spark"
                              : "image"
                        }
                        size={11}
                      />
                      {item.story?.ready
                        ? "故事可以读了"
                        : item.job
                          ? item.job.real
                            ? "AI 任务待查看"
                            : "故事演示准备中"
                          : "原画已收藏"}
                    </span>
                  </div>
                  <div className="card-title">
                    <h3>{item.title}</h3>
                    <span className="card-date">{item.date}</span>
                  </div>
                  <p className="quote">
                    {item.words
                      ? `“${item.words}”`
                      : item.parent || "有些想象，不需要解释。"}
                  </p>
                  <div className="card-foot">
                    <span>{item.sample ? "示例插画" : "家长记录"}</span>
                    <span>
                      {item.story?.ready ? "一起读 ↗" : "看看这幅画 ↗"}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="empty">
                <Icon name="book" size={38} />
                <h2>
                  {tab === "read"
                    ? "下一本故事，从一幅画开始"
                    : "这里等着下一份想象"}
                </h2>
                <p>先留下画，也可以只是留下一段珍贵的原话。</p>
                <button
                  className="primary"
                  onClick={tab === "read" ? onAlbum : onNew}
                >
                  {tab === "read" ? "去画册看看" : "留下一幅画"}
                </button>
              </div>
            )}
          </section>
          <div className="bottom-note">
            <Icon name="lock" size={12} /> {items.length}{" "}
            幅小小想象，安静地收藏在这里
          </div>
        </>
      )}
    </>
  );
}

export function Profile({ items, onBackup, onPrivacy }) {
  return (
    <>
      <section className="page-head">
        <div>
          <div className="eyebrow">A PLACE FOR LITTLE WONDERS</div>
          <h1>我们的收藏角</h1>
          <p>每一份记录，都由你来决定如何保存。</p>
        </div>
      </section>
      <div className="panel">
        <h2>小小收藏家的画册</h2>
        <p>
          画册记录保存在当前浏览器。清理浏览器数据或更换设备后可能无法找回，请及时导出。
        </p>
        <div className="stats">
          <div>
            <strong>
              {items.length}
              <small> / 30</small>
            </strong>
            <small>幅原画</small>
          </div>
          <div>
            <strong>{items.filter((i) => i.story?.ready).length}</strong>
            <small>本故事</small>
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="settings-row">
          <div>
            <h3>导出我的记录</h3>
            <p>下载包含原图、文字和录音的 JSON 备份。</p>
          </div>
          <button onClick={onBackup}>导出备份 ↗</button>
        </div>
        <div className="settings-row">
          <div>
            <h3>隐私与数据说明</h3>
            <p>AI 授权前仅存本机；授权后处理图和文字发送至生成服务。</p>
          </div>
          <button onClick={onPrivacy}>查看说明 ↗</button>
        </div>
      </div>
    </>
  );
}
