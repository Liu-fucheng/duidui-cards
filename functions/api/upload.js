// 文件路径: /functions/api/upload.js

/**
 * 辅助函数：将文件上传到 R2 并返回 Key
 */
async function uploadFileToR2(bucket, file, folder) {
    if (!file || typeof file.stream !== "function" || file.size === 0) {
      return null; // 不是有效的文件或空文件
    }
    const fileKey = `${folder}/${crypto.randomUUID()}-${file.name}`;
    await bucket.put(fileKey, file.stream(), {
      httpMetadata: { contentType: file.type },
    });
    return fileKey;
  }

  // 通知Discord Bot发帖
  async function notifyDiscordBot(env, cardData) {
    const botUrl = env.DISCORD_BOT_URL || 'https://your-bot-url.onrender.com';
    const webhookSecret = env.WEBHOOK_SECRET || 'your-secret-token';
    
    console.log(`📤 通知Bot发帖: ${botUrl}/api/post-card`);
    
    // 准备发送给bot的数据
    const payload = {
      cardId: cardData.cardId,
      cardName: cardData.cardName,
      cardType: cardData.cardType,
      characters: cardData.characters,
      category: cardData.category,
      authorName: cardData.authorName,
      isAnonymous: cardData.isAnonymous,
      orientation: cardData.orientation,
      background: cardData.background,
      tags: cardData.tags,
      warnings: cardData.warnings,
      description: cardData.description,
      threadTitle: cardData.threadTitle,
      otherInfo: cardData.otherInfo,
      // 完整的文件URL
      avatarImageUrl: cardData.avatarImageKey ? `${env.R2_PUBLIC_URL}/${cardData.avatarImageKey}` : null,
      cardFileUrl: `${env.R2_PUBLIC_URL}/${cardData.cardFileKey}`,
      cardFileKey: cardData.cardFileKey,
      cardJsonFileKey: cardData.cardJsonFileKey,
      galleryImageUrls: cardData.galleryImageKeys.map(key => `${env.R2_PUBLIC_URL}/${key}`),
      attachmentKeys: cardData.attachmentKeys || [],
      attachmentOriginalNames: cardData.attachmentOriginalNames || [],
      attachmentDescriptions: cardData.attachmentDescriptions || [],
      attachmentSummary: cardData.attachmentSummary || '',
      downloadRequirements: cardData.downloadRequirements || [], // 下载要求列表
      requireReaction: cardData.requireReaction || false, // 兼容旧字段
      requireComment: cardData.requireComment || false,
      // 提交者信息
      submitterUserId: cardData.submitterUserId,
      submitterUsername: cardData.submitterUsername,
      submitterDisplayName: cardData.submitterDisplayName
    };
    
    try {
      const response = await fetch(`${botUrl}/api/post-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${webhookSecret}`
        },
        body: JSON.stringify(payload),
        // 设置超时，避免长时间等待
        signal: AbortSignal.timeout(30000) // 30秒超时
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Bot已接收发卡请求:', result);
        return { success: true, ...result };
      } else {
        const errorText = await response.text();
        console.error('❌ Bot响应错误:', response.status, errorText);
        throw new Error(`Bot响应错误: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('❌ 通知Bot失败:', error);
      // 不抛出错误，允许降级处理
      return { success: false, error: error.message };
    }
  }

  // 保存角色卡数据到KV
  async function saveCharacterCardToKV(env, cardData) {
    if (!env.CLOUDFLARE_KV_NAMESPACE) {
      console.log('KV namespace未配置，跳过保存');
      return;
    }

    const key = `card_${cardData.cardId}`;
    await env.CLOUDFLARE_KV_NAMESPACE.put(key, JSON.stringify(cardData));
    console.log(`角色卡已保存到KV: ${key}`);
  }

  // 发送发卡日志
  async function sendUploadLog(env, logData) {
    const UPLOAD_LOG_CHANNEL_ID = '1429834614431547553';  // 发卡日志频道
    const botToken = env.DISCORD_BOT_TOKEN;
    
    if (!botToken) {
      console.error('DISCORD_BOT_TOKEN未配置，无法发送日志');
      return;
    }

    // 分区ID映射（用于生成频道链接）
    const CHANNEL_MAPPING = {
      '非边限': env.DISCORD_CHANNEL_FEIBIANXIAN || '1429315799146954762',
      '边限': env.DISCORD_CHANNEL_BIANXIAN || '1429315841903558788', 
      '深渊': env.DISCORD_CHANNEL_SHENYUAN || '1429315883368710264'
    };

    const channelId = CHANNEL_MAPPING[logData.category];
    
    // 生成时间字符串
    const now = new Date();
    const timeStr = now.toLocaleDateString('zh-CN', { 
      month: 'numeric', 
      day: 'numeric' 
    }).replace('/', '月') + '日';

    // 生成帖子URL
    const threadUrl = `https://discord.com/channels/${logData.guildId || '1338365085072101416'}/${logData.threadId}`;
    
    // 构建日志消息：xx（账号：xxx）于时间在分区投递角色卡xxx（名字），标题：xxx - url
    const logMessage = `${logData.displayName}（账号：${logData.username}）于${timeStr}在<#${channelId}>投递角色卡${logData.cardName}，标题：${logData.threadTitle} - ${threadUrl}`;

    try {
      // 使用Bot API发送日志
      const response = await fetch(`https://discord.com/api/v10/channels/${UPLOAD_LOG_CHANNEL_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: logMessage
        })
      });

      if (response.ok) {
        console.log('发卡日志已发送');
      } else {
        const error = await response.text();
        console.error('发送日志失败:', response.status, error);
      }
    } catch (error) {
      console.error('发送日志时出错:', error);
    }
  }

  // 获取或创建webhook
  async function getOrCreateWebhook(channelId, botToken) {
    // 获取现有webhooks
    const webhooksResponse = await fetch(`https://discord.com/api/v10/channels/${channelId}/webhooks`, {
      headers: {
        'Authorization': `Bot ${botToken}`,
      },
    });

    if (!webhooksResponse.ok) {
      throw new Error(`获取webhooks失败: ${webhooksResponse.status}`);
    }

    const webhooks = await webhooksResponse.json();
    const existingWebhook = webhooks.find(wh => wh.name === '角色卡投递');

    if (existingWebhook) {
      return existingWebhook;
    }

    // 创建新webhook
    const createResponse = await fetch(`https://discord.com/api/v10/channels/${channelId}/webhooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '角色卡投递',
      })
    });

    if (!createResponse.ok) {
      throw new Error(`创建webhook失败: ${createResponse.status}`);
    }

    return await createResponse.json();
  }

  // 格式化Discord帖子内容
  function formatDiscordPost(cardData, env) {
    let content = '';
    
    // 基本信息（无空格，与预览格式一致）
    content += `**作者：**${cardData.authorName}\n`;
    content += `**卡名：**${cardData.cardName}\n`;
    
    // 角色名（仅不同名或多人卡显示）
    if (cardData.cardType === 'multi' || (cardData.cardType === 'single' && cardData.characters.length > 0)) {
      content += `**角色：**${cardData.characters.join(' / ')}\n`;
    }
    
    // 性向
    if (cardData.orientation && cardData.orientation.length > 0) {
      content += `**性向：**${cardData.orientation.join(' / ')}\n`;
    }
    
    // 背景
    if (cardData.background && cardData.background.length > 0) {
      content += `**背景：**${cardData.background.join(' / ')}\n`;
    }
    
    // Tags
    if (cardData.tags && cardData.tags.length > 0) {
      content += `**Tags：**${cardData.tags.join(' / ')}\n`;
    }
    
    // 自定义板块（从 otherInfo 解析，排除已单独显示的字段）
    const customSections = [];
    const remainingLines = [];
    
    if (cardData.otherInfo) {
      const lines = cardData.otherInfo.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // 检查是否为自定义板块格式（标题: 值）
        const match = trimmed.match(/^([^：:]+)[：:]\s*(.+)$/);
        if (match) {
          const title = match[1].trim().replace(/\*/g, '');
          const values = match[2].trim();
          
          // 跳过已单独显示的字段
          if (title === '性向' || title === '背景' || title === '下载要求') {
            continue;
          }
          
          // 将逗号分隔的值转换为 " / " 分隔
          const valueList = values.split(/[,，、]/).map(v => v.trim()).filter(v => v);
          if (valueList.length > 0) {
            customSections.push({ title, value: valueList.join(' / ') });
          }
        } else {
          // 不是自定义板块格式的行，保留到最后
          remainingLines.push(trimmed);
        }
      }
    }
    
    // 添加自定义板块（格式：**标题：**值，无空格）
    for (const section of customSections) {
      content += `**${section.title}：**${section.value}\n`;
    }
    
    content += '\n';
    
    // 排雷
    content += `**排雷：**\n${cardData.warnings || '未填写'}\n`;
    
    // 简介（非深渊分区显示）
    if (cardData.category !== '深渊' && cardData.description) {
      content += `\n**简介：**\n${cardData.description}\n`;
    }
    
    // 其她信息（无标签，直接显示剩余内容）
    if (remainingLines.length > 0) {
      content += `\n${remainingLines.join('\n')}\n`;
    }

    return {
      main: content
    };
  }

  // 发送附加内容（简介按钮、下载按钮等）
  async function sendAdditionalContent(threadId, cardData, botToken, env) {
    const baseUrl = `https://discord.com/api/v10/channels/${threadId}/messages`;
    
    try {
      // 如果是深渊分区，发送点赞按钮
      if (cardData.category === '深渊') {
        await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: '',
            components: [{
              type: 1,
              components: [{
                type: 2,
                style: 2,
                label: '❤️',
                custom_id: `like_post_${cardData.cardId}`
              }]
            }]
          })
        });
      }
      
      // 发送查看简介按钮
      await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: '点击下方按钮查看角色卡简介：',
          components: [{
            type: 1,
            components: [{
              type: 2,
              style: 1,
              label: '查看简介',
              custom_id: `view_intro_${cardData.cardId}`
            }]
          }]
        })
      });
      
      // 发送下载按钮
      await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: '点击下方按钮下载角色卡：',
          components: [{
            type: 1,
            components: [{
              type: 2,
              style: 3,
              label: '下载角色卡',
              custom_id: `download_card_${cardData.cardId}`
            }]
          }]
        })
      });
      
    } catch (error) {
      console.error('发送附加内容失败:', error);
      // 不抛出错误，因为主帖已经发送成功
    }
  }
  
  export async function onRequestPost(context) {
    try {
      const { request, env } = context;
      
      // 检查绑定
      if (!env.D1_DB || !env.R2_BUCKET) {
        return new Response(JSON.stringify({ success: false, message: "服务器D1或R2未正确绑定" }), { status: 500 });
      }
      
      const formData = await request.formData();
  
      // 1. 处理作者逻辑
      const authorType = formData.get("authorType"); // 'real' 或 'anonymous'
      let isAnonymous = authorType === "anonymous" ? 1 : 0;
      let authorName = formData.get("authorName") || "";
      let authorId = formData.get("authorId") || ""; // Discord bot 传入的作者ID（已废弃，改用submitterUserId）
      if (isAnonymous && authorName.trim() === "") {
        authorName = "匿名"; // 匿名且马甲为空，则默认为"匿名"
      }
      
      // 1.5. 提取提交者信息（从Token验证结果）
      const submitterUserId = formData.get("submitterUserId") || "";
      const submitterUsername = formData.get("submitterUsername") || "";
      const submitterDisplayName = formData.get("submitterDisplayName") || "";
  
      // 2. 处理文件上传 (并行)
      const cardFile = formData.get("cardFile");  // PNG文件
      const cardJsonFile = formData.get("cardJsonFile");  // JSON文件
      
      // 至少要有一个文件
      if ((!cardFile || cardFile.size === 0) && (!cardJsonFile || cardJsonFile.size === 0)) {
        return new Response(JSON.stringify({ success: false, message: "必须上传至少一个角色卡文件（PNG或JSON）" }), { status: 400 });
      }
  
      // 上传PNG卡片（如果有）
      let cardFileKey = null;
      if (cardFile && cardFile.size > 0) {
        cardFileKey = await uploadFileToR2(env.R2_BUCKET, cardFile, "cards");
        if (!cardFileKey) {
          return new Response(JSON.stringify({ success: false, message: "PNG卡片文件上传失败" }), { status: 400 });
        }
      }
      
      // 上传JSON卡片（如果有）
      let cardJsonFileKey = null;
      if (cardJsonFile && cardJsonFile.size > 0) {
        cardJsonFileKey = await uploadFileToR2(env.R2_BUCKET, cardJsonFile, "cards");
        if (!cardJsonFileKey) {
          return new Response(JSON.stringify({ success: false, message: "JSON卡片文件上传失败" }), { status: 400 });
        }
      }

      // 上传头像 (单文件，选填)
      let avatarImageKey = null;
      const avatarImage = formData.get("avatarImage");
      if (avatarImage && avatarImage.size > 0) {
        avatarImageKey = await uploadFileToR2(env.R2_BUCKET, avatarImage, "avatars");
      }

      // 上传主楼图片 (多图)
      const galleryFiles = formData.getAll("galleryImages");
      const galleryUploadPromises = galleryFiles.map(file => uploadFileToR2(env.R2_BUCKET, file, "gallery"));
      const galleryImageKeys = (await Promise.all(galleryUploadPromises)).filter(Boolean); // 过滤掉 null

      // 上传其它附件 (多图)
      const attachmentFiles = formData.getAll("attachments");
      const attachmentUploadPromises = attachmentFiles.map(file => uploadFileToR2(env.R2_BUCKET, file, "attachments"));
      const attachmentKeys = (await Promise.all(attachmentUploadPromises)).filter(Boolean);

      // 附件名称、描述和总说明（用于下载时展示）
      const defaultAttachmentNames = attachmentFiles.map(file => file?.name || '').filter(Boolean);

      let attachmentOriginalNames = [];
      const rawAttachmentNames = formData.get("attachmentOriginalNames");
      if (rawAttachmentNames) {
        try {
          const text = typeof rawAttachmentNames === 'string' ? rawAttachmentNames : await rawAttachmentNames.text();
          if (text) {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              attachmentOriginalNames = parsed.map(name => (name ?? '').toString());
            }
          }
        } catch (e) {
          console.error('解析附件原始文件名失败:', e);
        }
      }
      if (!Array.isArray(attachmentOriginalNames) || attachmentOriginalNames.length === 0) {
        attachmentOriginalNames = defaultAttachmentNames;
      }
      while (attachmentOriginalNames.length < attachmentKeys.length) {
        const idx = attachmentOriginalNames.length;
        attachmentOriginalNames.push(defaultAttachmentNames[idx] || (attachmentKeys[idx] ? attachmentKeys[idx].split('/').pop() : ''));
      }
      if (attachmentOriginalNames.length > attachmentKeys.length) {
        attachmentOriginalNames = attachmentOriginalNames.slice(0, attachmentKeys.length);
      }

      let attachmentDescriptions = [];
      const rawAttachmentDescriptions = formData.get("attachmentDescriptions");
      if (rawAttachmentDescriptions) {
        try {
          const text = typeof rawAttachmentDescriptions === 'string' ? rawAttachmentDescriptions : await rawAttachmentDescriptions.text();
          if (text) {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              attachmentDescriptions = parsed.map(desc => (desc ?? '').toString());
            }
          }
        } catch (e) {
          console.error('解析附件描述失败:', e);
        }
      }
      if (!Array.isArray(attachmentDescriptions)) {
        attachmentDescriptions = [];
      }
      while (attachmentDescriptions.length < attachmentKeys.length) {
        attachmentDescriptions.push('');
      }
      if (attachmentDescriptions.length > attachmentKeys.length) {
        attachmentDescriptions = attachmentDescriptions.slice(0, attachmentKeys.length);
      }

      let attachmentSummary = '';
      const rawAttachmentSummary = formData.get("attachmentSummary");
      if (rawAttachmentSummary) {
        try {
          if (typeof rawAttachmentSummary === 'string') {
            attachmentSummary = rawAttachmentSummary;
          } else if (typeof rawAttachmentSummary.text === 'function') {
            attachmentSummary = await rawAttachmentSummary.text();
          }
        } catch (e) {
          console.error('解析附件总说明失败:', e);
        }
      }
      attachmentSummary = (attachmentSummary || '').trim();
  
      // 3.5. 自动收集自定义板块数据（先收集，用于回填性向/背景）
      // 读取配置以识别自定义板块字段
      let customSectionsData = {};
      try {
        const configRow = await env.D1_DB.prepare('SELECT value FROM app_config WHERE key = ?')
          .bind('ui_config')
          .first();
        if (configRow && configRow.value) {
          const config = JSON.parse(configRow.value);
          if (config.customSections && Array.isArray(config.customSections)) {
            // 遍历每个自定义板块，收集对应的表单数据
            config.customSections.forEach(section => {
              const title = section.title;
              // 兼容多种命名：custom_<标题> / custom_<标题>[] / section_<标题>
              const candidateKeys = [
                `custom_${title}`,
                `custom_${title}[]`,
                `section_${title}`
              ];
              let values = [];
              for (const key of candidateKeys) {
                const arr = formData.getAll(key).filter(v => typeof v === 'string' && v.trim() !== '');
                if (arr && arr.length > 0) {
                  values = arr;
                  break;
                }
              }
              if (values.length > 0) {
                customSectionsData[title] = values;
              }
            });
          }
        }
      } catch (configError) {
        console.error('读取配置或收集自定义板块数据失败:', configError);
        // 继续执行，不影响主流程
      }
      
      // 3. 处理数组/JSON 数据（支持从自定义板块回填）
      const characters = JSON.stringify(formData.getAll("characters").filter(c => c.trim() !== ""));
      
      // 性向：优先从自定义板块获取，否则从表单字段获取
      let orientationArr = [];
      if (Array.isArray(customSectionsData['性向']) && customSectionsData['性向'].length > 0) {
        orientationArr = customSectionsData['性向'];
      } else {
        // 尝试从表单字段获取（兼容旧字段名）
        orientationArr = formData.getAll("orientation").filter(v => v && v.trim() !== '');
      }
      
      // 背景：优先从自定义板块获取，否则从表单字段获取
      let backgroundsArr = [];
      if (Array.isArray(customSectionsData['背景']) && customSectionsData['背景'].length > 0) {
        backgroundsArr = customSectionsData['背景'];
      } else {
        // 尝试从表单字段获取（兼容旧字段名）
        backgroundsArr = formData.getAll("background").filter(v => v && v.trim() !== '');
      }
      
      // Tags：从表单字段获取
      const tags = JSON.stringify(formData.getAll("tags").filter(v => v && v.trim() !== ''));
      
      // 将自定义板块数据合并到 otherInfo（排除性向和背景，因为它们已单独存储）
      let otherInfoValue = formData.get("otherInfo") || "";
      if (Object.keys(customSectionsData).length > 0) {

        const customDataStr = Object.entries(customSectionsData)
        .filter(([key, _]) => key !== '性向' && key !== '背景') 
        .map(([key, values]) => `${key}: ${values.join(', ')}`)
        .join('\n');
      
        if (customDataStr) { // 仅当有内容时才添加
          otherInfoValue = otherInfoValue ? `${otherInfoValue}\n\n${customDataStr}` : customDataStr;
        }
      }

      // 最终JSON字符串
      const orientation = JSON.stringify(orientationArr);
      const backgrounds = JSON.stringify(backgroundsArr);
  
      // 4. 准备插入 D1 数据库 (使用新表 cards_v2)
      // 注意：如果表中没有相关字段，需要先执行:
      // ALTER TABLE cards_v2 ADD COLUMN avatarImageKey TEXT;
      // ALTER TABLE cards_v2 ADD COLUMN threadId TEXT;
      // ALTER TABLE cards_v2 ADD COLUMN firstMessageId TEXT;
      const cardId = crypto.randomUUID();

      // 5. 提取下载要求（从自定义板块）
      const downloadRequirements = customSectionsData['下载要求'] || [];
      const requireLike = downloadRequirements.includes('点赞') || downloadRequirements.includes('like');
      const requireComment = downloadRequirements.includes('评论') || downloadRequirements.includes('comment');
      
      // 5.5. 提取主要标签（primaryTags）
      let primaryTags = [];
      try {
        const primaryTagsStr = formData.get("primaryTags");
        if (primaryTagsStr) {
          primaryTags = JSON.parse(primaryTagsStr);
        }
      } catch (e) {
        console.error('解析primaryTags失败:', e);
      }

      // 5. 通知Discord Bot发帖（仅匿名投递自动发帖）
      let discordInfo = null;
      
      // 检查是否为实名投递
      if (authorType === 'real' || isAnonymous === 0) {
        console.log("ℹ️ 实名投递，跳过自动发帖，等待用户使用/发卡命令");
        // 实名投递不自动通知Bot，用户需要自己发帖后使用 /发卡 命令
      } else {
        // 匿名投递，自动通知Bot发帖
      try {
        const notifyResult = await notifyDiscordBot(env, {
          cardId,
          cardName: formData.get("cardName") || "未命名",
          cardType: formData.get("cardType"),
          characters: JSON.parse(characters),
          category: formData.get("category"),
          authorName,
          isAnonymous,
          orientation: JSON.parse(orientation),
          background: JSON.parse(backgrounds),
          tags: JSON.parse(tags),
          warnings: formData.get("warnings"),
          description: formData.get("description"),
          threadTitle: formData.get("threadTitle") || "",
          otherInfo: otherInfoValue,
          avatarImageKey,
          galleryImageKeys,
          cardFileKey,
          cardJsonFileKey,
          attachmentKeys,
          attachmentOriginalNames,
          attachmentDescriptions,
          attachmentSummary,
            downloadRequirements: downloadRequirements, // 传递下载要求列表
            requireReaction: requireLike, // 兼容旧字段
            requireComment: requireComment,
            // 提交者信息
            submitterUserId,
            submitterUsername,
            submitterDisplayName,
            // 主要标签
            primaryTags
        });

        if (notifyResult.success) {
          console.log("✅ 已通知Bot发帖");
          discordInfo = notifyResult;
          // 保存角色卡数据到KV（供bot查询）
          try {
            await saveCharacterCardToKV(env, {
              cardId,
              cardName: formData.get("cardName") || "未命名",
              authorName,
              category: formData.get("category"),
              orientation: JSON.parse(orientation),
              background: JSON.parse(backgrounds),
              tags: JSON.parse(tags),
              description: formData.get("description"),
              warnings: formData.get("warnings"),
              otherInfo: otherInfoValue,
              avatarImageUrl: avatarImageKey ? `${env.R2_PUBLIC_URL}/${avatarImageKey}` : null,
              cardFileUrl: `${env.R2_PUBLIC_URL}/${cardFileKey}`,
              galleryImageUrls: galleryImageKeys.map(key => `${env.R2_PUBLIC_URL}/${key}`),
              cardFileKey,
              cardJsonFileKey,
              attachmentKeys,
              attachmentOriginalNames,
              attachmentDescriptions,
              attachmentSummary,
              uploadTime: new Date().toISOString()
            });
          } catch (kvError) {
            console.error('保存到KV失败:', kvError);
          }
        } else {
          console.error("❌ 通知Bot失败:", notifyResult.error);
          // 继续保存到数据库，Bot会从数据库读取待发布的卡片
        }
      } catch (discordError) {
        console.error("通知Bot异常:", discordError);
        // 继续保存到数据库
        }
      }

      // 6. 插入数据库，包含Discord信息
      // 检查表结构
      let tableColumns = [];
      try {
        const tableInfo = await env.D1_DB.prepare('PRAGMA table_info(cards_v2)').all();
        tableColumns = tableInfo.results ? tableInfo.results.map(col => col.name) : [];
      } catch (e) {
        console.error('检查表结构失败:', e);
      }

      const hasCardJsonFileKey = tableColumns.includes('cardJsonFileKey');
      const hasDownloadRequirements = tableColumns.includes('downloadRequirements');
      const hasRequireReaction = tableColumns.includes('requireReaction');
      const hasRequireComment = tableColumns.includes('requireComment');
      const hasPrimaryTags = tableColumns.includes('primaryTags');
      const hasAttachmentOriginalNames = tableColumns.includes('attachmentOriginalNames');
      const hasAttachmentDescriptions = tableColumns.includes('attachmentDescriptions');
      const hasAttachmentSummary = tableColumns.includes('attachmentSummary');
      const hasThreadId = tableColumns.includes('threadId');
      const hasFirstMessageId = tableColumns.includes('firstMessageId');
      const hasSubmitterUserId = tableColumns.includes('submitterUserId');
      const hasSubmitterUsername = tableColumns.includes('submitterUsername');
      const hasSubmitterDisplayName = tableColumns.includes('submitterDisplayName');

      const userLimitJson = JSON.stringify(formData.getAll("userLimit").filter(v => v && v.trim() !== "")) || "[]";
      const attachmentKeysJson = JSON.stringify(attachmentKeys);
      const attachmentOriginalNamesJson = JSON.stringify(attachmentOriginalNames);
      const attachmentDescriptionsJson = JSON.stringify(attachmentDescriptions);

      const columns = [
        'id',
        'cardName',
        'cardType',
        'characters',
        'category',
        'authorName',
        'authorId',
        'isAnonymous',
        'orientation',
        'background',
        'tags',
        'userLimit',
        'warnings',
        'description',
        'secondaryWarning',
        'threadTitle',
        'otherInfo',
        'avatarImageKey',
        'galleryImageKeys',
        'cardFileKey'
      ];

      const values = [
        cardId,
        formData.get("cardName") || "未命名",
        formData.get("cardType"),
        characters,
        formData.get("category"),
        authorName,
        authorId,
        isAnonymous,
        orientation,
        backgrounds,
        tags,
        userLimitJson,
        formData.get("warnings"),
        formData.get("description"),
        formData.get("secondaryWarning"),
        formData.get("threadTitle") || "",
        otherInfoValue,
        avatarImageKey,
        JSON.stringify(galleryImageKeys),
        cardFileKey || null
      ];

      if (hasCardJsonFileKey) {
        columns.push('cardJsonFileKey');
        values.push(cardJsonFileKey || null);
      }

      columns.push('attachmentKeys');
      values.push(attachmentKeysJson);

      if (hasAttachmentOriginalNames) {
        columns.push('attachmentOriginalNames');
        values.push(attachmentOriginalNamesJson);
      }
      if (hasAttachmentDescriptions) {
        columns.push('attachmentDescriptions');
        values.push(attachmentDescriptionsJson);
        console.log('🔍 [upload] 保存附件描述到数据库:', attachmentDescriptionsJson, '长度:', attachmentDescriptions.length);
      } else {
        console.log('⚠️ [upload] 数据库表没有 attachmentDescriptions 字段');
      }
      if (hasAttachmentSummary) {
        columns.push('attachmentSummary');
        values.push(attachmentSummary);
        console.log('🔍 [upload] 保存附件总说明到数据库:', attachmentSummary);
      } else {
        console.log('⚠️ [upload] 数据库表没有 attachmentSummary 字段');
      }

      if (hasThreadId) {
        columns.push('threadId');
        values.push(discordInfo?.threadId || null);
      }
      if (hasFirstMessageId) {
        columns.push('firstMessageId');
        values.push(discordInfo?.firstMessageId || null);
      }

      if (hasSubmitterUserId) {
        columns.push('submitterUserId');
        values.push(submitterUserId || null);
      }
      if (hasSubmitterUsername) {
        columns.push('submitterUsername');
        values.push(submitterUsername || null);
      }
      if (hasSubmitterDisplayName) {
        columns.push('submitterDisplayName');
        values.push(submitterDisplayName || null);
      }
      if (hasPrimaryTags) {
        columns.push('primaryTags');
        values.push(JSON.stringify(primaryTags));
      }

      if (hasDownloadRequirements) {
        columns.push('downloadRequirements');
        values.push(JSON.stringify(downloadRequirements));
        if (hasRequireReaction) {
          columns.push('requireReaction');
          values.push(requireLike ? 1 : 0);
        }
        if (hasRequireComment) {
          columns.push('requireComment');
          values.push(requireComment ? 1 : 0);
        }
      }

      const placeholders = columns.map(() => '?').join(', ');
      const sanitizedValues = values.map(value => (value === undefined ? null : value));
      await env.D1_DB.prepare(
        `INSERT INTO cards_v2 (${columns.join(', ')}) VALUES (${placeholders})`
      ).bind(...sanitizedValues).run();

      // 返回成功信息，实名投递需要返回cardId
      const responseData = { 
        success: true, 
        message: "卡片上传成功！",
        cardId: cardId  // 返回卡片ID给前端
      };
      
      return new Response(JSON.stringify(responseData), { status: 200, headers: { "Content-Type": "application/json" } });
  
    } catch (error) {
      console.error(error);
      return new Response(JSON.stringify({ success: false, message: "服务器内部错误: " + error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }