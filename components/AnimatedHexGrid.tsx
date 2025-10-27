import React from 'react';

export const AnimatedHexGrid: React.FC = () => {
  const svgDataUrl = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%2286.6%22%20viewBox%3D%220%200%20100%2086.6%22%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%23164e63%22%20stroke-width%3D%221%22%3E%3Cpath%20d%3D%22M50%200%20L100%2028.86%20V86.6%20L50%2057.73%20L0%2086.6%20V28.86%20z%22%2F%3E%3Cpath%20d%3D%22M50%200%20L0%2028.86%22%2F%3E%3Cpath%20d%3D%22M100%2028.86%20L50%2057.73%22%2F%3E%3Cpath%20d%3D%22M0%2086.6L50%2057.73%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E";

  return (
    <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
      <div 
        className="absolute w-[150%] h-[150%] top-[-25%] left-[-25%] animate-pan opacity-10"
        style={{ backgroundImage: `url("${svgDataUrl}")` }}
      ></div>
    </div>
  );
};