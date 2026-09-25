export function imageRequest(model){
 const sizes={'gemini-3.1-flash-image-preview':'512','gemini-3-pro-image-preview':'1K','gemini-2.5-flash-image':null};
 if(!Object.hasOwn(sizes,model))throw new Error('Unsupported test image model');
 const imageConfig={aspectRatio:'1:1'};
 if(sizes[model])imageConfig.imageSize=sizes[model];
 return {contents:[{role:'user',parts:[{text:'Create one simple hand-drawn crayon illustration on cream paper: a small blue puppy with round ears and a red scarf sitting beside a pond looking at the moon. Gentle bedtime picture-book mood. No text, no lettering, no panels.'}]}],generationConfig:{responseModalities:['Text','Image'],imageConfig}};
}
