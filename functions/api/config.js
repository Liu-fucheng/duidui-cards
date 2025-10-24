// 文件路径: /functions/api/config.js

/**
 * 配置接口 - 返回表单选项配置
 * 可在此处集中管理所有下拉选项和多选项
 */
export async function onRequestGet(context) {
  try {
    const config = {
      orientations: [
        { value: 'GB', label: 'GB' },
        { value: 'BG', label: 'BG' },
        { value: 'GL', label: 'GL' },
        { value: 'BL', label: 'BL' },
        { value: 'none', label: '无CP' }
      ],
      backgrounds: [
        { value: 'modern', label: '现代' },
        { value: 'ancient', label: '古代' },
        { value: 'future', label: '未来' },
        { value: 'fantasy', label: '幻想' },
        { value: 'scifi', label: '科幻' },
        { value: 'historical', label: '历史' }
      ],
      tagCategories: [
        {
          category: '场景',
          tags: [
            { value: 'campus', label: '校园' },
            { value: 'city', label: '都市' },
            { value: 'workplace', label: '职场' },
            { value: 'fantasy', label: '幻想世界' }
          ]
        },
        {
          category: '关系',
          tags: [
            { value: 'older', label: '年上' },
            { value: 'younger', label: '年下' },
            { value: 'childhood', label: '青梅竹马' },
            { value: 'enemy', label: '敌对关系' }
          ]
        },
        {
          category: '风格',
          tags: [
            { value: 'sweet', label: '甜文' },
            { value: 'angst', label: '虐文' },
            { value: 'comedy', label: '轻松' },
            { value: 'mystery', label: '悬疑' },
            { value: 'thriller', label: '惊悚' }
          ]
        }
      ],
      limits: [
        { value: 'none', label: '无' },
        { value: 'female', label: '限女User' },
        { value: 'male', label: '限男User' }
      ]
    };

    return new Response(JSON.stringify({ success: true, config }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600" // 缓存1小时
      },
    });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ success: false, message: "获取配置失败: " + error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}


