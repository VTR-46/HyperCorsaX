typedef struct {
    int packetId;
    float gas;
    float brake;
    float fuel;         
    int gear;
    int rpms;
    float steerAngle;   
    float speedKmh;     
    float velocity[3];  
    float accG[3];  
    float wheelSlip[4];  
    float wheelLoad[4];  
    float wheelPressure[4] ; 
    float wheelAngularSpeed[4]; 
    float tyreWear[4];  
    float tyreDirtyLevel[4];  
    float TyreCoreTemp[4]; 
    float camberRAD[4];  
    float suspensionTravel[4];  
    float drs;  
    float tc;
    float heading;
    float pitch;
    float roll;
    float cgHeight;
    float carDamage[5];
    int numberOfTyresOut;
    int pitLimiterOn;
    float abs;
    float kersCharge;
    float kersInput;
    int autoshifterOn;
    float rideHeight[2];
    float turboBoost;
    float ballast;
    float airDensity;
    float airTemp;
    float roadTemp;
    float localAngularVelocity[3];
    float finalFF;
    float performanceMeter;
    int engineBrake;
    int ersRecoveryLevel;
    int ersPowerLevel;
    int ersHeatCharging;
    int ersCurrentKJ;
    float brakesBias;
    float localVelocity[3];
    int P2PActivations;
    int P2PStatus;
    int currentMaxRpm;
    float mz[4];
    float fx[4];
    float fy[4];
    float slipAngles[4];
    float slipRatio[4];
    float wheelsPressure[4];
    int numCompletedLaps;
    float tyreTemp[4];

} SPageFilePhysics;

typedef enum {
    AC_OFF = 0,
    AC_REPLAY = 1,
    AC_LIVE = 2,
    AC_PAUSE = 3
} AC_STATUS;

typedef enum {
    AC_UNKNOWN = -1,
    AC_PRACTICE = 0,
    AC_QUALIFY = 1,
    AC_RACE = 2,
    AC_HOTLAP = 3,
    AC_TIME_ATTACK = 4,
    AC_DRIFT = 5,
    AC_DRAG = 6,
    AC_HOTSTINT = 7,
    AC_HOTLAPSUPERPOLE = 8
} AC_SESSION_TYPE;

typedef enum {
    AC_NO_FLAG = 0,
    AC_BLUE_FLAG = 1,
    AC_YELLOW_FLAG = 2,
    AC_BLACK_FLAG = 3,
    AC_WHITE_FLAG = 4,
    AC_CHECKERED_FLAG = 5,
    AC_PENALTY_FLAG = 6
} AC_FLAG_TYPE;

typedef enum {
    AC_NONE = 0,
    AC_DRIVE_THROUGH_PENALTY = 1,
    AC_STOP_AND_GO_PENALTY = 2,
    AC_PIT_SPEEDING_PENALTY = 3,
    AC_DISQUALIFIED = 4,
    AC_BEST_LAP_DELETED = 5,
    AC_TIME_PENALTY = 6
} AC_PENALTY_TYPE;

// Estrutura principal Graphic
typedef struct {
    int packetId;
    AC_STATUS status;
    AC_SESSION_TYPE session;
    wchar_t currentTime[15];
    wchar_t lastTime[15];
    wchar_t bestTime[15];
    wchar_t split[15];
    int completedLaps;
    int position;
    int iCurrentTime;
    int iLastTime;
    int iBestTime;
    float sessionTimeLeft;
    float distanceTraveled;
    int isInPit;
    int currentSectorIndex;
    int lastSectorTime;
    int numberOfLaps;
    wchar_t tyreCompound[33];
    float replayTimeMultiplier;
    float normalizedCarPosition;
    
    int activeCars;
    float carCoordinates[60][3];
    int carID[60];
    int playerCarID;
    float penaltyTime;
    AC_FLAG_TYPE flag;
    AC_PENALTY_TYPE penalty;
    int idealLineOn;
    int isInPitLane;
    
    float surfaceGrip;
    int mandatoryPitDone;
    
    float windSpeed;
    float windDirection;
} SPageFileGraphic;
    
