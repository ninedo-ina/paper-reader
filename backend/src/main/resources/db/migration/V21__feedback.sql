-- 公测期的问题反馈：把「用户能说话」这条通道打开。
-- 本轮只做「入库 + 落盘」——不做后台查看页，也不转发通知中心，所以这张表就是唯一落点。
--
--   user_id      提交人（反馈随账号级联删除：账号没了，反馈没有保留意义）
--   page_path    提交时所在页面（复现问题先要知道用户在哪一屏）
--   app_version  前端版本号（公测期版本变得快，不带版本号的问题报告无法定位）
--   user_agent   浏览器 UA（页面渲染类问题基本靠它判断）
--   screenshots  截图元数据数组（path/name/size/mime）。图片字节在磁盘上，这里只存索引，
--                所以一张 JSON 列即可：暂时没有「按截图查询」的需求，不必拆第二张表。
CREATE TABLE pr_feedbacks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES pr_users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    page_path VARCHAR(500),
    app_version VARCHAR(50),
    user_agent VARCHAR(500),
    locale VARCHAR(20),
    screenshots jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedbacks_user_created ON pr_feedbacks(user_id, created_at);
