-- REQ-202609-0110：个人中心「从本地上传」的头像走 data URL（base64），
-- 一张几十 KB 的图片编码后就有几万字符，VARCHAR(500) 存不下，
-- 上传接口会直接报错，用户永远设不上自定义头像。这里把列放宽（保持 varchar
-- 类型不变，避免和 Hibernate 的 ddl-auto=validate 打架）。
ALTER TABLE pr_users ALTER COLUMN avatar_url TYPE VARCHAR(1000000);
