const bcrypt = require('bcryptjs');

const hash = '$2b$10$nnrLniUWbr4DX0y7ZI1GkeP02nw2CJR0akmDe8jWRWPExuaNAKTBi';
console.log('Testing hash:', hash);

async function test() {
    const match1 = await bcrypt.compare('ScalePods@123', hash);
    console.log('ScalePods@123 matches:', match1);

    const match2 = await bcrypt.compare('wrongpassword', hash);
    console.log('wrongpassword matches:', match2);

    // Also generate a fresh hash to verify the process end-to-end
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash('ScalePods@123', salt);
    console.log('Fresh hash:', newHash);
    const match3 = await bcrypt.compare('ScalePods@123', newHash);
    console.log('Fresh hash matches:', match3);
}

test().catch(console.error);
