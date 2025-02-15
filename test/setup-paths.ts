import { TestFile } from "./test-types.js";

const sourceFilesRaw: TestFile[] = [
  {
    path: "dir1/file1.txt",
    sizeInBytes: 1024
  },
  {
    path: "dir1/file19.txt",
    sizeInBytes: 49152
  },
  {
    path: "dir1/file31.txt",
    sizeInBytes: 9437184
  },
  {
    path: "dir1/file43.txt",
    sizeInBytes: 22020096
  },
  {
    path: "dir1/file55.txt",
    sizeInBytes: 34603008
  },
  {
    path: "dir1/file67.txt",
    sizeInBytes: 47185920
  },
  {
    path: "dir1/file7.txt",
    sizeInBytes: 16384
  },
  {
    path: "dir1/file79.txt",
    sizeInBytes: 59768832
  },
  {
    path: "dir1/file91.txt",
    sizeInBytes: 72351744
  },
  {
    path: "dir1/subdir1/file2.dat",
    sizeInBytes: 2048576
  },
  {
    path: "dir1/subdir10/file51.bin",
    sizeInBytes: 30408704
  },
  {
    path: "dir1/subdir11/file59.dat",
    sizeInBytes: 38797312
  },
  {
    path: "dir1/subdir12/file63.bin",
    sizeInBytes: 42991616
  },
  {
    path: "dir1/subdir13/file71.dat",
    sizeInBytes: 51380224
  },
  {
    path: "dir1/subdir14/file75.bin",
    sizeInBytes: 55574528
  },
  {
    path: "dir1/subdir15/file83.dat",
    sizeInBytes: 63963136
  },
  {
    path: "dir1/subdir16/file87.bin",
    sizeInBytes: 68157440
  },
  {
    path: "dir1/subdir17/file95.dat",
    sizeInBytes: 76546048
  },
  {
    path: "dir1/subdir18/file99.bin",
    sizeInBytes: 80740352
  },
  {
    path: "dir1/subdir2/file4.txt",
    sizeInBytes: 512000
  },
  {
    path: "dir1/subdir3/file11.dat",
    sizeInBytes: 262144
  },
  {
    path: "dir1/subdir4/file15.bin",
    sizeInBytes: 3072
  },
  {
    path: "dir1/subdir5/file23.dat",
    sizeInBytes: 786432
  },
  {
    path: "dir1/subdir6/file27.bin",
    sizeInBytes: 5242880
  },
  {
    path: "dir1/subdir7/file35.dat",
    sizeInBytes: 13631488
  },
  {
    path: "dir1/subdir8/file39.bin",
    sizeInBytes: 17825792
  },
  {
    path: "dir1/subdir9/file47.dat",
    sizeInBytes: 26214400
  },
  {
    path: "dir2/file13.txt",
    sizeInBytes: 768
  },
  {
    path: "dir2/file25.txt",
    sizeInBytes: 3145728
  },
  {
    path: "dir2/file37.txt",
    sizeInBytes: 15728640
  },
  {
    path: "dir2/file3.bin",
    sizeInBytes: 4096
  },
  {
    path: "dir2/file49.txt",
    sizeInBytes: 28311552
  },
  {
    path: "dir2/file61.txt",
    sizeInBytes: 40894464
  },
  {
    path: "dir2/file73.txt",
    sizeInBytes: 53477376
  },
  {
    path: "dir2/file85.txt",
    sizeInBytes: 66060288
  },
  {
    path: "dir2/file97.txt",
    sizeInBytes: 78643200
  },
  {
    path: "dir2/subdir1/file6.bin",
    sizeInBytes: 8192
  },
  {
    path: "dir2/subdir10/file57.bin",
    sizeInBytes: 36700160
  },
  {
    path: "dir2/subdir11/file65.dat",
    sizeInBytes: 45088768
  },
  {
    path: "dir2/subdir12/file69.bin",
    sizeInBytes: 49283072
  },
  {
    path: "dir2/subdir13/file77.dat",
    sizeInBytes: 57671680
  },
  {
    path: "dir2/subdir14/file81.bin",
    sizeInBytes: 61865984
  },
  {
    path: "dir2/subdir15/file89.dat",
    sizeInBytes: 70254592
  },
  {
    path: "dir2/subdir16/file93.bin",
    sizeInBytes: 74448896
  },
  {
    path: "dir2/subdir2/file9.bin",
    sizeInBytes: 65536
  },
  {
    path: "dir2/subdir3/file17.dat",
    sizeInBytes: 12288
  },
  {
    path: "dir2/subdir4/file21.bin",
    sizeInBytes: 196608
  },
  {
    path: "dir2/subdir5/file29.dat",
    sizeInBytes: 7340032
  },
  {
    path: "dir2/subdir6/file33.bin",
    sizeInBytes: 11534336
  },
  {
    path: "dir2/subdir7/file41.dat",
    sizeInBytes: 19922944
  },
  {
    path: "dir2/subdir8/file45.bin",
    sizeInBytes: 24117248
  },
  {
    path: "dir2/subdir9/file53.dat",
    sizeInBytes: 32505856
  },
  {
    path: "dir3/file14.dat",
    sizeInBytes: 1536
  },
  {
    path: "dir3/file26.dat",
    sizeInBytes: 4194304
  },
  {
    path: "dir3/file38.dat",
    sizeInBytes: 16777216
  },
  {
    path: "dir3/file5.dat",
    sizeInBytes: 1048576
  },
  {
    path: "dir3/file50.dat",
    sizeInBytes: 29360128
  },
  {
    path: "dir3/file62.dat",
    sizeInBytes: 41943040
  },
  {
    path: "dir3/file74.dat",
    sizeInBytes: 54525952
  },
  {
    path: "dir3/file86.dat",
    sizeInBytes: 67108864
  },
  {
    path: "dir3/file98.dat",
    sizeInBytes: 79691776
  },
  {
    path: "dir3/subdir1/file10.txt",
    sizeInBytes: 131072
  },
  {
    path: "dir3/subdir10/file66.bin",
    sizeInBytes: 46137344
  },
  {
    path: "dir3/subdir11/file70.txt",
    sizeInBytes: 50331648
  },
  {
    path: "dir3/subdir12/file78.bin",
    sizeInBytes: 58720256
  },
  {
    path: "dir3/subdir13/file82.txt",
    sizeInBytes: 62914560
  },
  {
    path: "dir3/subdir14/file90.bin",
    sizeInBytes: 71303168
  },
  {
    path: "dir3/subdir15/file94.txt",
    sizeInBytes: 75497472
  },
  {
    path: "dir3/subdir2/file18.bin",
    sizeInBytes: 24576
  },
  {
    path: "dir3/subdir3/file22.txt",
    sizeInBytes: 393216
  },
  {
    path: "dir3/subdir4/file30.bin",
    sizeInBytes: 8388608
  },
  {
    path: "dir3/subdir5/file34.txt",
    sizeInBytes: 12582912
  },
  {
    path: "dir3/subdir6/file42.bin",
    sizeInBytes: 20971520
  },
  {
    path: "dir3/subdir7/file46.txt",
    sizeInBytes: 25165824
  },
  {
    path: "dir3/subdir8/file54.bin",
    sizeInBytes: 33554432
  },
  {
    path: "dir3/subdir9/file58.txt",
    sizeInBytes: 37748736
  },
  {
    path: "dir4/file20.dat",
    sizeInBytes: 98304
  },
  {
    path: "dir4/file32.dat",
    sizeInBytes: 10485760
  },
  {
    path: "dir4/file44.dat",
    sizeInBytes: 23068672
  },
  {
    path: "dir4/file56.dat",
    sizeInBytes: 35651584
  },
  {
    path: "dir4/file68.dat",
    sizeInBytes: 48234496
  },
  {
    path: "dir4/file8.dat",
    sizeInBytes: 32768
  },
  {
    path: "dir4/file80.dat",
    sizeInBytes: 60817408
  },
  {
    path: "dir4/file92.dat",
    sizeInBytes: 73400320
  },
  {
    path: "dir4/subdir1/file12.bin",
    sizeInBytes: 524288
  },
  {
    path: "dir4/subdir10/file64.txt",
    sizeInBytes: 44040192
  },
  {
    path: "dir4/subdir11/file72.bin",
    sizeInBytes: 52428800
  },
  {
    path: "dir4/subdir12/file76.txt",
    sizeInBytes: 56623104
  },
  {
    path: "dir4/subdir13/file84.bin",
    sizeInBytes: 65011712
  },
  {
    path: "dir4/subdir14/file88.txt",
    sizeInBytes: 69206016
  },
  {
    path: "dir4/subdir15/file96.bin",
    sizeInBytes: 77594624
  },
  {
    path: "dir4/subdir16/file100.txt",
    sizeInBytes: 81788928
  },
  {
    path: "dir4/subdir2/file16.txt",
    sizeInBytes: 6144
  },
  {
    path: "dir4/subdir3/file24.bin",
    sizeInBytes: 1572864
  },
  {
    path: "dir4/subdir4/file28.txt",
    sizeInBytes: 6291456
  },
  {
    path: "dir4/subdir5/file36.bin",
    sizeInBytes: 14680064
  },
  {
    path: "dir4/subdir6/file40.txt",
    sizeInBytes: 18874368
  },
  {
    path: "dir4/subdir7/file48.bin",
    sizeInBytes: 27262976
  },
  {
    path: "dir4/subdir8/file52.txt",
    sizeInBytes: 31457280
  },
  {
    path: "dir4/subdir9/file60.bin",
    sizeInBytes: 39845888
  }
];

const FACTOR = 100;

export const sourceFiles: TestFile[] = sourceFilesRaw.map(file => ({
  ...file,
  sizeInBytes: Math.floor(file.sizeInBytes / FACTOR)
}));

