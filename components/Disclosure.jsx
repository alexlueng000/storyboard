export function AiNotice() {
  return (
    <>
      <p className="muted" style={{ marginTop: 18 }}>
        一幅原画，三页 AI 续画，做成一本静态图文故事。
      </p>
      <details className="ai-disclosure">
        <summary>数据使用与费用说明</summary>
        <p className="muted">
          处理图、描述及可选的孩子原话会发送至 Poixe
          及上游模型，可能涉及境外处理；原声不发送。生成任务与结果还会保存到提供服务的服务器。中断请求据服务方文档暂存
          3
          天，完整留存与训练政策仍待核验，请仅使用已获授权的素材。生成会使用服务端账号余额，费用以服务方账单为准；当前没有向家长收款的入口。结果尚未经过正式内容审核，请家长先查看。
        </p>
      </details>
    </>
  );
}
export function Privacy() {
  return (
    <>
      <p className="muted">
        画册使用当前浏览器保存原图、处理图、文字及可选录音。选择 AI
        生成并授权后，处理图、描述、可选孩子原话和设定会发送至服务器与 Poixe
        模型服务；原声不发送。生成任务和结果也会在服务器保留。
      </p>
      <div className="notice">
        无需注册，任务访问权限绑定当前浏览器。清除网站数据、更换浏览器或设备后，可能无法找回记录及生成任务。AI
        结果请家长先查看。
      </div>
      <p className="muted">
        可下载原图、导出画册备份或删除作品。删除作品会请求清除服务器上的关联任务；已发送给模型服务的数据不能通过这里直接撤回。
      </p>
    </>
  );
}
