# 内网批量图片接口说明

本文档说明供内网服务调用的批量图片生成和批量图片编辑接口。接口会读取服务器本机 CSV 文件，复用现有图片任务队列和并发控制，生成结果强制保存到本机目录，不上传 R2。

## 基本约束

- 接口面向可信内网调用，当前不依赖前台登录态；生产部署时应通过网关、防火墙或反向代理限制访问来源。
- 调用方必须传入本机绝对路径。
- `csv_path` 必须是服务器本机可读取的 CSV 文件绝对路径。
- `output_dir` 必须是服务器本机输出目录绝对路径；目录不存在时会自动创建。
- 批量编辑 CSV 中的 `input_image_paths` 也必须全部是服务器本机绝对路径。
- 批量编辑一行最多支持 10 张输入图片，多个路径用英文分号 `;` 分隔。
- 任务进入现有队列后异步执行，接口返回的是已创建的任务列表，不等待图片生成完成。
- 失败任务会自动重新进入队尾重试，默认最多 3 次，可通过 `max_retries` 覆盖。
- 生成完成后，任务里的 `images[].path` 是输出图片的本机绝对路径。

## 批量生成

`POST /api/internal/batch-generate`

请求体：

```json
{
  "csv_path": "/data/gpt-image/jobs/generate.csv",
  "output_dir": "/data/gpt-image/outputs",
  "owner_user_id": "internal-api",
  "max_retries": 3
}
```

字段说明：

| 字段 | 必填 | 类型 | 说明 |
| --- | --- | --- | --- |
| `csv_path` | 是 | string | 批量生成 CSV 文件的本机绝对路径。 |
| `output_dir` | 是 | string | 输出图片保存目录的本机绝对路径。 |
| `owner_user_id` | 否 | string | 任务归属标识；不传时默认为 `internal-api`。 |
| `max_retries` | 否 | number | 失败后自动重试次数；不传时默认为 `3`，传 `0` 表示不自动重试。 |

批量生成 CSV 表头必须为：

```csv
prompt,model,n,size,width,height,quality,output_format,output_compression,background,moderation,stream,partial_images
```

CSV 示例：

```csv
prompt,model,n,size,width,height,quality,output_format,output_compression,background,moderation,stream,partial_images
"一张未来城市夜景海报",gpt-image-2,1,auto,,,auto,png,100,auto,auto,false,2
"白底产品摄影图，主体是一只陶瓷杯",gpt-image-2,2,square,,,high,webp,90,auto,auto,false,2
```

调用示例：

```bash
curl -X POST http://127.0.0.1:3000/api/internal/batch-generate \
  -H 'Content-Type: application/json' \
  -d '{
    "csv_path": "/data/gpt-image/jobs/generate.csv",
    "output_dir": "/data/gpt-image/outputs",
    "owner_user_id": "internal-api",
    "max_retries": 3
  }'
```

## 批量编辑

`POST /api/internal/batch-edit`

请求体：

```json
{
  "csv_path": "/data/gpt-image/jobs/edit.csv",
  "output_dir": "/data/gpt-image/outputs",
  "owner_user_id": "internal-api",
  "max_retries": 3
}
```

批量编辑 CSV 表头必须为：

```csv
prompt,input_image_paths,model,n,size,width,height,quality,stream,partial_images
```

CSV 示例：

```csv
prompt,input_image_paths,model,n,size,width,height,quality,stream,partial_images
"把源图改成复古电影海报风格","/data/gpt-image/inputs/person.png",gpt-image-2,1,auto,,,auto,false,2
"保留第一张主体，参考第二张的色彩和材质","/data/gpt-image/inputs/source.png;/data/gpt-image/inputs/style.png",gpt-image-2,1,auto,,,high,false,2
```

调用示例：

```bash
curl -X POST http://127.0.0.1:3000/api/internal/batch-edit \
  -H 'Content-Type: application/json' \
  -d '{
    "csv_path": "/data/gpt-image/jobs/edit.csv",
    "output_dir": "/data/gpt-image/outputs",
    "owner_user_id": "internal-api",
    "max_retries": 3
  }'
```

## 响应格式

创建成功时返回 `202`：

```json
{
  "jobs": [
    {
      "id": "job_xxx",
      "ownerUserId": "internal-api",
      "status": "pending",
      "mode": "generate",
      "prompt": "一张未来城市夜景海报",
      "model": "gpt-image-2",
      "params": {
        "storage_mode": "fs",
        "force_local_output": "true",
        "return_absolute_paths": "true",
        "output_dir": "/data/gpt-image/outputs",
        "auto_retry": "true",
        "max_auto_retries": "3"
      },
      "images": []
    }
  ],
  "errors": []
}
```

说明：

- `status` 初始为 `pending`，随后由队列切换为 `running`、`completed` 或 `failed`。
- 任务完成后，`images[].path` 会变成本机绝对路径，例如 `/data/gpt-image/outputs/1760000000000-uuid-0.png`。
- 内网 API 创建的任务会强制写入 `storage_mode=fs` 和 `return_absolute_paths=true`。

## 图片获取路径

内网批量接口不会直接返回图片内容。调用方需要先保存创建接口返回的 `jobs[].id`，随后轮询任务状态；当任务状态变为 `completed` 后，从任务对象的 `images` 数组读取输出图片路径。

完成后的任务结构示例：

```json
{
  "id": "job_xxx",
  "status": "completed",
  "images": [
    {
      "filename": "1760000000000-uuid-0.png",
      "output_format": "png",
      "path": "/data/gpt-image/outputs/1760000000000-uuid-0.png"
    }
  ]
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `images[].path` | 输出图片的本机绝对路径，内网调用方应优先使用该字段读取图片文件。 |
| `images[].filename` | 输出文件名，不包含目录。 |
| `images[].output_format` | 输出格式，生成模式跟随 CSV 的 `output_format`，编辑模式固定为 `png`。 |

示例读取方式：

```bash
# 假设轮询任务后拿到 path=/data/gpt-image/outputs/1760000000000-uuid-0.png
ls -lh /data/gpt-image/outputs/1760000000000-uuid-0.png
```

注意：

- `images[].path` 是服务器本机路径，不是 HTTP 图片 URL。
- 如果调用方运行在另一台机器，需要通过共享存储、挂载目录、文件同步服务或后续补充下载接口来读取图片。
- 创建接口返回时任务通常仍是 `pending`，此时 `images` 为空；只有 `completed` 后才会写入图片路径。

## 错误响应

参数或 CSV 校验失败时返回 `400`：

```json
{
  "error": "csv_path 必须是本机绝对路径。"
}
```

常见错误：

- `csv_path 必须是本机绝对路径。`
- `output_dir 必须是本机绝对路径。`
- `CSV 表头必须是：...`
- `第 2 行：prompt 不能为空。`
- `第 2 行：input_image_paths 只支持本机绝对路径。`

## 查询任务

任务仍保存在现有 image-jobs 表中。当前内网创建接口只负责创建任务；如需轮询任务状态和获取 `images[].path`，可复用现有任务查询逻辑，或后续补一个按 `owner_user_id` / `job_id` 查询的内网接口。
