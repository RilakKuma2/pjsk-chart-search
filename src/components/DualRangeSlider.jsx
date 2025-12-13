import React from 'react';

const DualRangeSlider = ({ min, max, value, onChange, formatLabel, step = 1 }) => {
    const [minVal, maxVal] = value;

    // Calculate percentage for track background
    const minPercent = Math.round(((minVal - min) / (max - min)) * 100);
    const maxPercent = Math.round(((maxVal - min) / (max - min)) * 100);

    return (
        <div className="range-slider-container">
            <div className="range-values">
                <span>{formatLabel ? formatLabel(minVal) : minVal}</span>
                <span>{formatLabel ? formatLabel(maxVal) : maxVal}</span>
            </div>
            <div className="slider-track-container">
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={minVal}
                    step={step}
                    onChange={(event) => {
                        const val = Math.min(Number(event.target.value), maxVal - step);
                        onChange([val, maxVal]);
                    }}
                    className="thumb thumb--left"
                    style={{ zIndex: minVal > max - 100 ? 5 : undefined }}
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={maxVal}
                    step={step}
                    onChange={(event) => {
                        const val = Math.max(Number(event.target.value), minVal + step);
                        onChange([minVal, val]);
                    }}
                    className="thumb thumb--right"
                />
                <div className="slider-track"></div>
                <div
                    className="slider-range"
                    style={{ left: `${minPercent}%`, width: `${maxPercent - minPercent}%` }}
                ></div>
            </div>
        </div>
    );
};

export default DualRangeSlider;
